// backend/verifyRound.js
// Backend verifier for Quiza — the "trusted" side of the v1 flow described in Quiza.sol.
//
// Responsibility:
//  1. Receive a player's submitted answers for a completed round.
//  2. Check them against the real question bank (never sent to the client with answers).
//  3. Decide win/loss based on the score threshold.
//  4. Call resolve(roundId, won) on-chain using the verifier's private key.
//
// Run as an Express route, a serverless function (Vercel/Netlify), or a Celo Composer
// API route — the core logic (verifyAndResolve) is framework-agnostic.

import { JsonRpcProvider, Wallet, Contract } from "ethers";
import questionBank from "../src/data/questions.json" assert { type: "json" };
import { QUIZA_ABI, QUIZA_CONTRACT_ADDRESS, CELO_NETWORKS } from "../src/lib/quizaContract.js";

const WIN_THRESHOLD = 0.7; // 7/10 correct or better wins

// --- Env / secrets --------------------------------------------------------
// VERIFIER_PRIVATE_KEY must belong to the address set as `verifier` in Quiza.sol.
// Never expose this key to the frontend or commit it to git — load from env only.
const VERIFIER_PRIVATE_KEY = process.env.QUIZA_VERIFIER_PRIVATE_KEY;
const NETWORK = process.env.QUIZA_NETWORK || "alfajores"; // "alfajores" | "mainnet"

function getVerifierWallet() {
  const provider = new JsonRpcProvider(CELO_NETWORKS[NETWORK].rpcUrls[0]);
  return new Wallet(VERIFIER_PRIVATE_KEY, provider);
}

/**
 * Scores a set of submitted answers against the real question bank.
 * @param {string[]} questionIds - ids of the questions shown to the player, in order
 * @param {number[]} submittedAnswers - the option index the player chose for each question (-1 = skipped/timed out)
 * @returns {{ correctCount: number, total: number, won: boolean }}
 */
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

/**
 * Full verify-and-resolve flow: score the round, then submit the result on-chain.
 * @param {{ roundId: string, questionIds: string[], submittedAnswers: number[] }} payload
 * @returns {{ won: boolean, correctCount: number, total: number, txHash: string }}
 */
export async function verifyAndResolve({ roundId, questionIds, submittedAnswers }) {
  if (!VERIFIER_PRIVATE_KEY) {
    throw new Error("QUIZA_VERIFIER_PRIVATE_KEY is not set in environment");
  }
  if (questionIds.length !== submittedAnswers.length) {
    throw new Error("questionIds and submittedAnswers length mismatch");
  }

  const { correctCount, total, won } = scoreRound(questionIds, submittedAnswers);

  const verifierWallet = getVerifierWallet();
  const contract = new Contract(QUIZA_CONTRACT_ADDRESS[NETWORK], QUIZA_ABI, verifierWallet);

  const tx = await contract.resolve(roundId, won);
  const receipt = await tx.wait();

  return { won, correctCount, total, txHash: receipt.hash };
}

// --- Example Express route -------------------------------------------------
// import express from "express";
// const router = express.Router();
// router.post("/api/verify-round", async (req, res) => {
//   try {
//     const result = await verifyAndResolve(req.body);
//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(400).json({ error: err.message });
//   }
// });
// export default router;

// --- Example Vercel serverless function (api/verify-round.js) --------------
// export default async function handler(req, res) {
//   if (req.method !== "POST") return res.status(405).end();
//   try {
//     const result = await verifyAndResolve(req.body);
//     res.status(200).json(result);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// }
