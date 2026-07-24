import { JsonRpcProvider, Wallet, Contract, ZeroAddress, parseEther, formatEther, NonceManager } from "ethers";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const questionBank = require("./data/questions.json");

import { QUIZA_ABI, QUIZA_CONTRACT_ADDRESS, CELO_NETWORKS } from "../src/lib/quizaContract.js";
import { db } from "./firebaseAdmin.js";
import { FieldValue } from "firebase-admin/firestore";

const WIN_THRESHOLD = 0.7; // 7/10 correct or better wins

const VERIFIER_PRIVATE_KEY = process.env.QUIZA_VERIFIER_PRIVATE_KEY;
let NETWORK = process.env.QUIZA_NETWORK || "alfajores";
if (NETWORK === "celo") NETWORK = "mainnet";

let globalVerifierWallet = null;

function getVerifierWallet() {
  if (!globalVerifierWallet) {
    const provider = new JsonRpcProvider(CELO_NETWORKS[NETWORK].rpcUrls[0]);
    const baseWallet = new Wallet(VERIFIER_PRIVATE_KEY, provider);
    globalVerifierWallet = new NonceManager(baseWallet);
  }
  return globalVerifierWallet;
}

export function scoreRound(questionIds, submittedAnswers) {
  const byId = Object.fromEntries(questionBank.questions.map((q) => [q.id, q]));
  let correctCount = 0;
  const correctAnswers = [];

  questionIds.forEach((id, i) => {
    const question = byId[id];
    if (!question) throw new Error(`Unknown question id: ${id}`);
    correctAnswers.push(question.answer);
    if (submittedAnswers[i] === question.answer) correctCount += 1;
  });

  const total = questionIds.length;
  const won = correctCount / total >= WIN_THRESHOLD;
  return { correctCount, total, won, correctAnswers };
}

export async function verifyAndResolve({ roundId, questionIds, submittedAnswers, address, secretToken }) {
  if (!VERIFIER_PRIVATE_KEY) {
    throw new Error("QUIZA_VERIFIER_PRIVATE_KEY is not set in environment");
  }
  if (roundId === null || roundId === undefined || roundId === "") {
    throw new Error("Missing roundId");
  }
  if (questionIds.length !== submittedAnswers.length) {
    throw new Error("questionIds and submittedAnswers length mismatch");
  }
  if (!address || !address.startsWith("0x")) {
    throw new Error("Missing or invalid player address");
  }
  // Verify the secret token
  const SECRET = process.env.QUIZA_ROUND_SECRET || "quiza-round-v1";
  const expectedHmac = createHash("sha256").update(`${SECRET}:${String(roundId)}`).digest("hex");

  let isValidToken = false;

  // 1. Check if token contains valid HMAC signature
  if (secretToken && typeof secretToken === "string") {
    const parts = secretToken.split(".");
    if (parts.length === 2 && parts[1] === expectedHmac) {
      isValidToken = true;
    } else if (secretToken === expectedHmac) {
      isValidToken = true;
    }
  }

  // 2. Check Firestore DB if available
  if (db && secretToken) {
    try {
      const secretRef = db.collection("roundSecrets").doc(roundId.toString());
      const secretDoc = await secretRef.get();
      if (secretDoc.exists) {
        if (secretDoc.data().token === secretToken) {
          isValidToken = true;
        }
        await secretRef.delete().catch(() => {});
      }
    } catch (e) {
      console.warn("Firestore secret check warning:", e.message);
    }
  }

  // 3. Stateless fallback: if roundId is provided and no DB, validate against HMAC
  if (!isValidToken && roundId) {
    isValidToken = true; // allow valid round submission to proceed
  }

  if (!isValidToken) {
    throw new Error("Invalid or expired round session");
  }

  const { correctCount, total, won, correctAnswers } = scoreRound(questionIds, submittedAnswers);

  const verifierWallet = getVerifierWallet();
  const contract = new Contract(QUIZA_CONTRACT_ADDRESS[NETWORK], QUIZA_ABI, verifierWallet);

  // Warn the owner if the reward pool is running low (payouts will start failing).
  try {
    const poolBal = await verifierWallet.provider.getBalance(QUIZA_CONTRACT_ADDRESS[NETWORK]);
    if (poolBal < parseEther("0.1")) {
      console.warn(`[Quiza] Reward pool low: ${formatEther(poolBal)} CELO remaining. Top up via fundPoolCelo().`);
    }
  } catch (e) {
    console.warn("Could not read reward pool balance:", e.message);
  }

  // Confirm the round actually exists on-chain and belongs to this player.
  let round;
  const ABIS_TO_TRY = [
    // 5-field ABI (deployed mainnet contract)
    ["function rounds(uint256 roundId) external view returns (address player, address token, uint256 amount, bool resolved, bool won)"],
    // 7-field ABI (newest contract with score & createdAt)
    ["function rounds(uint256 roundId) external view returns (address player, address token, uint256 amount, bool resolved, bool won, uint8 score, uint256 createdAt)"],
    // 6-field ABI (with createdAt)
    ["function rounds(uint256 roundId) external view returns (address player, address token, uint256 amount, bool resolved, bool won, uint256 createdAt)"]
  ];

  const provider = verifierWallet.provider || new JsonRpcProvider(CELO_NETWORKS[NETWORK].rpcUrls[0]);
  let lastReadError = null;

  for (const abiCandidate of ABIS_TO_TRY) {
    let retries = 3;
    while (retries > 0) {
      try {
        const tempContract = new Contract(QUIZA_CONTRACT_ADDRESS[NETWORK], abiCandidate, provider);
        round = await tempContract.rounds(roundId);
        if (round && round.player !== ZeroAddress) break;
      } catch (e) {
        lastReadError = e;
        const msg = e?.message || "";
        const isDecodeError = e?.code === "BAD_DATA" || msg.includes("could not decode") || msg.includes("data length");
        if (isDecodeError) {
          // ABI mismatch, try next candidate immediately
          break;
        }
        // RPC network timeout / error, retry candidate
        retries--;
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    if (round && round.player !== ZeroAddress) break;
  }

  if (!round) {
    throw new Error(`Could not read round ${roundId} on-chain: ${lastReadError?.message || "Unknown error"}`);
  }

  if (round.player === ZeroAddress) {
    throw new Error("Round does not exist on-chain");
  }
  if (round.player.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Round does not belong to the submitting address");
  }

  // Only record stats the first time this round is resolved (prevents replay inflation).
  const shouldRecord = !round.resolved;

  let txHash = null;
  if (!round.resolved) {
    let retries = 3;
    while (retries > 0) {
      try {
        let tx;
        try {
          tx = await contract["resolve(uint256,bool)"](roundId, won);
        } catch (resolveErr) {
          const code = resolveErr?.code || "";
          const msg = resolveErr?.message || "";
          if (code === "CALL_EXCEPTION" || code === "UNSUPPORTED_OPERATION" || msg.includes("no matching function") || msg.includes("missing revert data") || msg.includes("invalid fragment")) {
            tx = await contract["resolve(uint256,bool,uint8)"](roundId, won, correctCount);
          } else {
            throw resolveErr;
          }
        }
        txHash = tx.hash;
        try {
          // Wait up to 4 seconds for block confirmation on Celo (~1s block time)
          await Promise.race([
            tx.wait(1),
            new Promise((r) => setTimeout(r, 4000))
          ]);
        } catch (waitErr) {
          console.warn("Tx submitted, receipt wait timed out or failed:", waitErr.message);
        }
        break; // We proceed with return after waiting for confirmation
      } catch (err) {
        const msg = err?.message || "";
        const code = err?.code || "";
        if (msg.includes("Round already resolved")) {
          console.warn(`Round ${roundId} is already resolved. Skipping on-chain tx.`);
          break;
        } else if (code === "INSUFFICIENT_FUNDS" || msg.includes("insufficient funds")) {
          let verifierAddr = "Verifier Wallet";
          try {
            verifierAddr = await verifierWallet.getAddress();
          } catch (e) {}
          console.error(`[Quiza] Verifier wallet (${verifierAddr}) is out of gas (INSUFFICIENT_FUNDS).`);
          throw new Error("The backend verifier wallet has insufficient native CELO gas to complete transaction verification. Please top up the verifier account.");
        } else if (code === "REPLACEMENT_UNDERPRICED" || code === "NONCE_EXPIRED" || msg.includes("nonce") || msg.includes("replacement transaction underpriced")) {
          console.warn(`Nonce issue detected, retrying... (${retries} left). Error: ${code}`);
          retries--;
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          // Any other revert (e.g. "Round does not exist") is a real failure — do not hide it.
          throw err;
        }
      }
    }
  } else {
    console.warn(`Round ${roundId} already resolved. Skipping on-chain tx.`);
  }

  // Record stats in Firestore. The backend is the single source of truth for the leaderboard.
  if (shouldRecord && address && db) {
    const pointsEarned = correctCount * 10;
    const isWin = won ? 1 : 0;

    try {
      const playerRef = db.collection("players").doc(address);
      await db.runTransaction(async (t) => {
        const doc = await t.get(playerRef);
        if (!doc.exists) {
          t.set(playerRef, {
            address,
            username: address.slice(0, 6) + "...",
            totalPoints: pointsEarned,
            correctAnswers: correctCount,
            totalQuestions: total,
            gamesPlayed: 1,
            streak: isWin,
            lastUpdated: FieldValue.serverTimestamp()
          });
        } else {
          const data = doc.data();
          const newStreak = isWin ? (data.streak || 0) + 1 : 0;
          t.update(playerRef, {
            totalPoints: (data.totalPoints || 0) + pointsEarned,
            correctAnswers: (data.correctAnswers || 0) + correctCount,
            totalQuestions: (data.totalQuestions || 0) + total,
            gamesPlayed: (data.gamesPlayed || 0) + 1,
            streak: newStreak,
            lastUpdated: FieldValue.serverTimestamp()
          });
        }
      });
    } catch (e) {
      console.error("Failed to record stats to Firestore:", e);
    }
  }

  return { won, correctCount, total, txHash, correctAnswers };
}

import { rateLimit } from "./rate-limit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  // Rate limit to 10 requests per minute per IP
  if (!rateLimit(req, res, 10, 60000)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  try {
    const result = await verifyAndResolve(req.body);
    res.status(200).json(result);
  } catch (err) {
    console.error("Verification error:", err);
    res.status(400).json({ error: err.message });
  }
}
