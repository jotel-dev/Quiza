import fs from "fs";
import path from "path";

function loadQuestions() {
  const candidates = [
    path.resolve(process.cwd(), "apps/api/data/questions.json"),
    new URL("../apps/api/data/questions.json", import.meta.url).pathname,
    path.resolve(process.cwd(), "data/questions.json"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, "utf-8"));
      }
    } catch {}
  }
  return { categories: [], questions: [] };
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { questionIds, submittedAnswers } = body;

    if (!Array.isArray(questionIds) || !Array.isArray(submittedAnswers)) {
      return res.status(400).json({ error: "questionIds and submittedAnswers arrays required" });
    }

    const bank = loadQuestions();
    const map = new Map(bank.questions.map((q) => [q.id, q]));

    let correctCount = 0;
    const correctAnswers = [];

    for (let i = 0; i < questionIds.length; i++) {
      const q = map.get(questionIds[i]);
      if (q) {
        correctAnswers.push(q.answer);
        if (submittedAnswers[i] === q.answer) {
          correctCount++;
        }
      }
    }

    const total = questionIds.length;
    const won = correctCount >= Math.ceil(total * 0.7);

    return res.status(200).json({
      won,
      correctCount,
      total,
      txHash: null,
      correctAnswers,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to verify practice round" });
  }
}
