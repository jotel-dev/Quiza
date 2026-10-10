import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHmac } from "crypto";

export const roundStore = new Map();

export function loadQuestions() {
  const candidates = [
    path.resolve(process.cwd(), "apps/api/data/questions.json"),
    path.resolve(process.cwd(), "data/questions.json"),
  ];

  try {
    const importMetaDir = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.resolve(importMetaDir, "../apps/api/data/questions.json"));
    candidates.push(path.resolve(importMetaDir, "../data/questions.json"));
  } catch {}

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, "utf-8"));
      }
    } catch {}
  }
  return { categories: [], questions: [] };
}

export function scoreRound(questionIds, submittedAnswers) {
  const bank = loadQuestions();
  const map = new Map((bank.questions || []).map((q) => [q.id, q]));

  let correctCount = 0;
  const correctAnswers = [];

  for (let i = 0; i < questionIds.length; i++) {
    const q = map.get(questionIds[i]);
    const expected = q ? q.answer : 0;
    correctAnswers.push(expected);
    if (submittedAnswers[i] === expected) {
      correctCount++;
    }
  }

  const total = questionIds.length;
  const won = total === 10 ? correctCount >= 7 : (total > 0 ? (correctCount / total >= 0.7) : false);

  return {
    correctCount,
    total,
    won,
    correctAnswers,
  };
}

export function verifySessionToken(token, expectedAddress) {
  if (!token || typeof token !== "string") return false;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const data = JSON.parse(raw);
    const { address, expiresAt, hmac } = data;
    if (!address || !expiresAt || !hmac) return false;
    if (Date.now() > expiresAt) return false;
    if (expectedAddress && address !== expectedAddress) return false;

    const secret = process.env.QUIZA_ROUND_SECRET || "quiza-secret-key-2026-production-secure";
    const expectedPayload = `${address}:${expiresAt}`;
    const computedHmac = createHmac("sha256", secret).update(expectedPayload).digest("hex");
    return hmac === computedHmac;
  } catch {
    return false;
  }
}
