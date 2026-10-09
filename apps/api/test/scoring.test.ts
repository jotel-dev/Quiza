import { describe, it, expect } from "vitest";
import {
  scoreRound,
  selectQuestions,
  seedFrom,
  mulberry32,
  loadQuestionBank,
} from "../src/scoring.js";

describe("Scoring Unit Tests", () => {
  const bank = loadQuestionBank();

  it("calculates correct answers and score accurately", () => {
    const q1 = bank.questions[0];
    const q2 = bank.questions[1];
    const q3 = bank.questions[2];

    const result = scoreRound(
      [q1.id, q2.id, q3.id],
      [q1.answer, q2.answer, (q3.answer + 1) % 4]
    );

    expect(result.total).toBe(3);
    expect(result.correctCount).toBe(2);
    expect(result.correctAnswers).toEqual([q1.answer, q2.answer, q3.answer]);
  });

  it("enforces won condition: score >= 7 on a 10-question round", () => {
    const questions = bank.questions.slice(0, 10);
    const qIds = questions.map((q) => q.id);

    // 7 correct answers -> won is true
    const answers7 = questions.map((q, idx) => (idx < 7 ? q.answer : (q.answer + 1) % 4));
    const res7 = scoreRound(qIds, answers7);
    expect(res7.correctCount).toBe(7);
    expect(res7.won).toBe(true);

    // 6 correct answers -> won is false
    const answers6 = questions.map((q, idx) => (idx < 6 ? q.answer : (q.answer + 1) % 4));
    const res6 = scoreRound(qIds, answers6);
    expect(res6.correctCount).toBe(6);
    expect(res6.won).toBe(false);

    // 10 correct answers -> won is true
    const answers10 = questions.map((q) => q.answer);
    const res10 = scoreRound(qIds, answers10);
    expect(res10.correctCount).toBe(10);
    expect(res10.won).toBe(true);
  });

  it("determines question selection deterministically from roundId and secret", () => {
    const secret = "test-secret-key-12345";
    const roundId = 42;

    const roundA = selectQuestions(secret, roundId, "standard");
    const roundB = selectQuestions(secret, roundId, "standard");

    expect(roundA.length).toBe(10);
    expect(roundB.length).toBe(10);
    expect(roundA.map((q) => q.id)).toEqual(roundB.map((q) => q.id));

    // Ensure answers are stripped in public view
    roundA.forEach((q) => {
      expect((q as any).answer).toBeUndefined();
      expect(q.options.length).toBe(4);
      expect(q.fiftyFifty.length).toBe(2);
    });

    // Different roundId yields different selection
    const roundC = selectQuestions(secret, 999, "standard");
    expect(roundA.map((q) => q.id)).not.toEqual(roundC.map((q) => q.id));
  });
});
