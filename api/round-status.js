import { roundStore } from "./_store.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { roundId } = req.query || {};

  if (!roundId) {
    return res.status(400).json({ error: "Missing or invalid roundId" });
  }

  const stringRoundId = String(roundId);

  if (roundStore.has(stringRoundId)) {
    const session = roundStore.get(stringRoundId);
    return res.status(200).json({
      roundId: stringRoundId,
      player: session.player || "",
      status: session.status || "resolved",
      score: session.correctCount ?? session.score ?? 0,
      correctCount: session.correctCount ?? session.score ?? 0,
      total: session.total ?? 10,
      won: Boolean(session.won),
      txHash: session.txHash || null,
      correctAnswers: session.correctAnswers || null,
      resolved: session.resolved ?? true,
      errorMessage: session.errorMessage || null,
    });
  }

  // If not yet in cache, return status: issued
  return res.status(200).json({
    roundId: stringRoundId,
    status: "issued",
    resolved: false,
    errorMessage: null,
  });
}
