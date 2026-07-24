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
  if (!secretToken) {
    throw new Error("Missing secure token for this round");
  }

  // Verify the secret token against Firestore to prevent griefing
  const secretRef = db.collection("roundSecrets").doc(roundId.toString());
  const secretDoc = await secretRef.get();
  
  if (!secretDoc.exists) {
    throw new Error("Invalid or expired round session");
  }
  
  if (secretDoc.data().token !== secretToken) {
    throw new Error("Unauthorized submission token");
  }
  
  // Delete the token immediately to prevent replay attacks
  await secretRef.delete();

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
  try {
    round = await contract.rounds(roundId);
  } catch (err) {
    throw new Error(`Could not read round ${roundId} on-chain: ${err.message}`);
  }
  if (!round || round.player === ZeroAddress) {
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
        const tx = await contract.resolve(roundId, won, correctCount);
        txHash = tx.hash;
        break; // We intentionally DO NOT await tx.wait() here
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
          if (retries === 0) throw err;
          // Invalidate the cached nonce to force fetching from the network again
          if (verifierWallet.reset) verifierWallet.reset();
          await new Promise(r => setTimeout(r, 800)); // small delay
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
