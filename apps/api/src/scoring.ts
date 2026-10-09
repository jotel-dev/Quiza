import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Questions bank path (located in apps/api/data/questions.json)
const questionsJsonPath = path.resolve(__dirname, "../../data/questions.json");

export interface Question {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  answer: number;
}

export interface QuestionBank {
  categories: string[];
  questions: Question[];
}

export function loadQuestionBank(): QuestionBank {
  const raw = fs.readFileSync(questionsJsonPath, "utf-8");
  return JSON.parse(raw);
}

export const CATEGORY_COLORS: Record<string, string> = {
  Math: "#4F46E5",
  History: "#F59E0B",
  Web3: "#10B981",
  "General Knowledge": "#EF4444",
  Geography: "#10B981",
};

export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(secret: string, roundId: string | number): number {
  const h = createHash("sha256").update(`${secret}:${String(roundId)}`).digest();
  return h.readUInt32BE(0);
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PublicQuestion {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  color: string;
  fiftyFifty: number[];
}

export function publicView(q: Question, rng: () => number): PublicQuestion {
  const wrongIndices = [0, 1, 2, 3].filter((i) => i !== q.answer);
  const randomWrong = wrongIndices[Math.floor(rng() * wrongIndices.length)];
  const fiftyFifty = shuffle([q.answer, randomWrong], rng);

  return {
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    question: q.question,
    options: q.options,
    color: CATEGORY_COLORS[q.category] || "#4F46E5",
    fiftyFifty,
  };
}

export function selectQuestions(
  secret: string,
  roundId: string | number,
  type = "standard",
  category = "Mixed",
  difficulty = "Mixed"
): PublicQuestion[] {
  const bank = loadQuestionBank();
  const rng = mulberry32(seedFrom(secret, roundId));

  let selected: Question[];
  if (type === "daily") {
    const mathHard = bank.questions.filter((q) => q.category === "Math" && q.difficulty === "hard");
    const web3Hard = bank.questions.filter((q) => q.category === "Web3" && q.difficulty === "hard");
    selected = [...shuffle(mathHard, rng).slice(0, 3), ...shuffle(web3Hard, rng).slice(0, 2)];
  } else if (type === "practice") {
    const pool = bank.questions;
    selected = shuffle(pool, rng).slice(0, 5);
  } else {
    let pool = bank.questions;
    if (category && category !== "Mixed") pool = pool.filter((q) => q.category === category);
    if (difficulty && difficulty !== "Mixed") pool = pool.filter((q) => q.difficulty === difficulty);

    selected = shuffle(pool, rng).slice(0, 10);

    if (selected.length < 10) {
      const needed = 10 - selected.length;
      const remaining = bank.questions.filter((q) => !selected.includes(q));
      selected = [...selected, ...shuffle(remaining, rng).slice(0, needed)];
    }
  }

  return shuffle(selected, rng).map((q) => publicView(q, rng));
}

export interface ScoreResult {
  correctCount: number;
  total: number;
  won: boolean;
  correctAnswers: number[];
}

export function scoreRound(questionIds: string[], submittedAnswers: number[]): ScoreResult {
  const bank = loadQuestionBank();
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  let correctCount = 0;
  const correctAnswers: number[] = [];

  questionIds.forEach((id, i) => {
    const question = byId.get(id);
    if (!question) throw new Error(`Unknown question id: ${id}`);
    correctAnswers.push(question.answer);
    if (submittedAnswers[i] === question.answer) {
      correctCount += 1;
    }
  });

  const total = questionIds.length;
  // Per rule: won must equal score >= 7 (for standard rounds of 10)
  const won = total === 10 ? correctCount >= 7 : correctCount / total >= 0.7;

  return { correctCount, total, won, correctAnswers };
}
