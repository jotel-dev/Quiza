import fs from "fs";
import path from "path";
import { createHash } from "crypto";

// Questions are selected here, server-side, and returned WITHOUT the answer field.
// Selection is deterministic per roundId (seeded with a server secret) so the same
// round always yields the same questions and the client cannot choose or inspect them.
const QUESTION_BANK_PATH = path.join(process.cwd(), "src/data/questions.json");
const SECRET = process.env.QUIZA_ROUND_SECRET || "quiza-round-v1";

const CATEGORY_COLORS = {
  Math: "#4F46E5",
  History: "#F59E0B",
  Web3: "#10B981",
  "General Knowledge": "#EF4444",
  Geography: "#10B981",
};

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(roundId) {
  const h = createHash("sha256").update(`${SECRET}:${String(roundId)}`).digest();
  return h.readUInt32BE(0);
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function publicView(q) {
  const { answer, ...rest } = q; // strip the answer
  return { ...rest, color: CATEGORY_COLORS[q.category] || "#4F46E5" };
}

export function selectQuestions(roundId, type = "standard") {
  const bank = JSON.parse(fs.readFileSync(QUESTION_BANK_PATH, "utf8"));
  const rng = mulberry32(seedFrom(roundId));

  let selected;
  if (type === "daily") {
    const mathHard = bank.questions.filter((q) => q.category === "Math" && q.difficulty === "hard");
    const web3Hard = bank.questions.filter((q) => q.category === "Web3" && q.difficulty === "hard");
    selected = [...shuffle(mathHard, rng).slice(0, 3), ...shuffle(web3Hard, rng).slice(0, 2)];
  } else {
    selected = shuffle(bank.questions, rng).slice(0, 10);
  }

  return shuffle(selected, rng).map(publicView);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { roundId, type } = req.body || {};
    if (!roundId) return res.status(400).json({ error: "Missing roundId" });
    const questions = selectQuestions(roundId, type);
    res.status(200).json({ questions });
  } catch (err) {
    console.error("round-questions error:", err);
    res.status(500).json({ error: "Failed to load questions" });
  }
}
