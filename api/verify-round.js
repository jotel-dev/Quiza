import { JsonRpcProvider, Wallet, Contract } from "ethers";
import questionBank from "../src/data/questions.json" with { type: "json" };
import { QUIZA_ABI, QUIZA_CONTRACT_ADDRESS, CELO_NETWORKS } from "../src/lib/quizaContract.js";
import { db } from "./firebaseAdmin.js";
import { FieldValue } from "firebase-admin/firestore";

const WIN_THRESHOLD = 0.7; // 7/10 correct or better wins

const VERIFIER_PRIVATE_KEY = process.env.QUIZA_VERIFIER_PRIVATE_KEY;
let NETWORK = process.env.QUIZA_NETWORK || "alfajores";
if (NETWORK === "celo") NETWORK = "mainnet";

function getVerifierWallet() {
  const provider = new JsonRpcProvider(CELO_NETWORKS[NETWORK].rpcUrls[0]);
  return new Wallet(VERIFIER_PRIVATE_KEY, provider);
}

export function scoreRound(questionIds, submittedAnswers) {
  const byId = Object.fromEntries(questionBank.questions.map((q) => [q.id, q]));
  let correctCount = 0;

  questionIds.forEach((id, i) => {
    const question = byId[id];
    if (!question) throw new Error(`Unknown question id: ${id}`);
    if (submittedAnswers[i] === question.answer) correctCount += 1;
  });

  const total = questionIds.length;
  const won = correctCount / total >= WIN_THRESHOLD;
  return { correctCount, total, won };
}

export async function verifyAndResolve({ roundId, questionIds, submittedAnswers, address }) {
  if (!VERIFIER_PRIVATE_KEY) {
    throw new Error("QUIZA_VERIFIER_PRIVATE_KEY is not set in environment");
  }
  if (questionIds.length !== submittedAnswers.length) {
    throw new Error("questionIds and submittedAnswers length mismatch");
  }

  const { correctCount, total, won } = scoreRound(questionIds, submittedAnswers);

  const verifierWallet = getVerifierWallet();
  const contract = new Contract(QUIZA_CONTRACT_ADDRESS[NETWORK], QUIZA_ABI, verifierWallet);

  let txHash = null;
  try {
    const tx = await contract.resolve(roundId, won);
    const receipt = await tx.wait();
    txHash = receipt.hash;
  } catch (err) {
    if (err.message && (err.message.includes("Round already resolved") || err.message.includes("execution reverted"))) {
      console.warn(`Round ${roundId} is already resolved. Skipping on-chain tx.`);
    } else {
      throw err;
    }
  }

  // Record stats in Firestore
  if (address && db) {
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

  return { won, correctCount, total, txHash };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const result = await verifyAndResolve(req.body);
    res.status(200).json(result);
  } catch (err) {
    console.error("Verification error:", err);
    res.status(400).json({ error: err.message });
  }
}
