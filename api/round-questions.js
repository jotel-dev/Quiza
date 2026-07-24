import { createRequire } from "module";
import { createHash, randomUUID } from "crypto";
import { db } from "./firebaseAdmin.js";

const require = createRequire(import.meta.url);
const questionBank = require("./data/questions.json");

// Questions are selected here, server-side.
// We return the answer so the frontend can provide immediate correct/incorrect UI feedback.
// Selection is deterministic per roundId (seeded with a server secret).
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

function publicView(q, rng) {
  // Generate 50/50 hint locally (correct + 1 random wrong)
  const wrongIndices = [0, 1, 2, 3].filter(i => i !== q.answer);
  const randomWrong = wrongIndices[Math.floor(rng() * wrongIndices.length)];
  const fiftyFifty = shuffle([q.answer, randomWrong], rng);
  
  return { ...q, color: CATEGORY_COLORS[q.category] || "#4F46E5", fiftyFifty };
}

export function selectQuestions(roundId, type = "standard", category = "Mixed", difficulty = "Mixed") {
  const bank = questionBank;
  const rng = mulberry32(seedFrom(roundId));

  let selected;
  if (type === "daily") {
    const mathHard = bank.questions.filter((q) => q.category === "Math" && q.difficulty === "hard");
    const web3Hard = bank.questions.filter((q) => q.category === "Web3" && q.difficulty === "hard");
    selected = [...shuffle(mathHard, rng).slice(0, 3), ...shuffle(web3Hard, rng).slice(0, 2)];
  } else if (type === "practice") {
    let pool = bank.questions;
    selected = shuffle(pool, rng).slice(0, 5);
  } else {
    let pool = bank.questions;
    if (category && category !== "Mixed") pool = pool.filter(q => q.category === category);
    if (difficulty && difficulty !== "Mixed") pool = pool.filter(q => q.difficulty === difficulty);
    
    selected = shuffle(pool, rng).slice(0, 10);
    
    // Backfill if needed
    if (selected.length < 10) {
      const needed = 10 - selected.length;
      const remaining = bank.questions.filter(q => !selected.includes(q));
      selected = [...selected, ...shuffle(remaining, rng).slice(0, needed)];
    }
  }

  return shuffle(selected, rng).map(q => publicView(q, rng));
}

import { rateLimit } from "./rate-limit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  // Rate limit to 10 requests per minute per IP
  if (!rateLimit(req, res, 10, 60000)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  try {
    const { roundId, type, category, difficulty, walletAddress } = req.body || {};
    if (!roundId) return res.status(400).json({ error: "Missing roundId" });

    if (type === "daily" && walletAddress && db) {
      const playerSnap = await db.collection("players").doc(walletAddress).get();
      if (playerSnap.exists) {
        const data = playerSnap.data();
        const todayStr = new Date().toDateString();
        if (data.lastDailyChallengeDate === todayStr) {
          return res.status(403).json({ error: "Daily challenge already played today" });
        }
      }
    }

    const questions = selectQuestions(roundId, type, category, difficulty);
    
    // Generate a secure, HMAC-signed token for this round to prevent griefing
    const hmacSig = createHash("sha256").update(`${SECRET}:${String(roundId)}`).digest("hex");
    const secretToken = `${randomUUID()}.${hmacSig}`;
    
    if (db) {
      try {
        await db.collection("roundSecrets").doc(roundId.toString()).set({
          token: secretToken,
          createdAt: new Date()
        });
      } catch (e) {
        console.warn("Could not save round secret to Firestore:", e.message);
      }
    }

    res.status(200).json({ questions, secretToken });
  } catch (err) {
    console.error("round-questions error:", err);
    res.status(500).json({ error: "Failed to load questions" });
  }
}
