import fs from "fs";
import path from "path";
import { createHash } from "crypto";

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

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { roundId = "practice", type = "practice", category = "Mixed", difficulty = "Mixed" } = body;

    const bank = loadQuestions();
    let pool = bank.questions;

    if (category && category !== "Mixed") {
      const filtered = pool.filter((q) => q.category === category);
      if (filtered.length >= 10) pool = filtered;
    }

    if (difficulty && difficulty !== "Mixed") {
      const filtered = pool.filter((q) => q.difficulty === difficulty);
      if (filtered.length >= 10) pool = filtered;
    }

    const h = createHash("sha256").update(`practice-secret:${String(roundId)}`).digest();
    const rng = mulberry32(h.readUInt32BE(0));
    const selected = shuffle(pool, rng).slice(0, 10);

    const questions = selected.map((q) => {
      const wrongIndices = [0, 1, 2, 3].filter((i) => i !== q.answer);
      const randomWrong = wrongIndices[Math.floor(rng() * wrongIndices.length)];
      const fiftyFifty = shuffle([q.answer, randomWrong], rng);
      return {
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        color: "#4F46E5",
        fiftyFifty,
      };
    });

    return res.status(200).json({
      questions,
      secretToken: `practice-${roundId}`,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate questions" });
  }
}
