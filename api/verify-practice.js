import { createRequire } from "module";
import { db } from "./firebaseAdmin.js";
import { scoreRound } from "./verify-round.js";
import { rateLimit } from "./rate-limit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  // Rate limit to 10 requests per minute per IP
  if (!rateLimit(req, res, 10, 60000)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  try {
    const { roundId, questionIds, submittedAnswers, secretToken } = req.body;
    
    if (!roundId || !questionIds || !submittedAnswers) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (questionIds.length !== submittedAnswers.length) {
      return res.status(400).json({ error: "questionIds and submittedAnswers length mismatch" });
    }

    // Clean up session token in Firestore if present
    if (db && secretToken) {
      try {
        const secretRef = db.collection("roundSecrets").doc(roundId.toString());
        await secretRef.delete().catch(() => {});
      } catch (e) {}
    }

    // Score the practice round without any blockchain interaction or leaderboard updates
    const { correctCount, total, won, correctAnswers } = scoreRound(questionIds, submittedAnswers);

    res.status(200).json({
      won,
      correctCount,
      total,
      txHash: null, // No tx for practice mode
      correctAnswers
    });
  } catch (err) {
    console.error("Practice verification error:", err);
    res.status(500).json({ error: err.message || "Failed to verify practice round" });
  }
}
