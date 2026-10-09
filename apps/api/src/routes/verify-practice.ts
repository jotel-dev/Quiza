import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { scoreRound } from "../scoring.js";
import { getDb } from "../db/index.js";

const practiceBodySchema = z.object({
  roundId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  questionIds: z.array(z.string()),
  submittedAnswers: z.array(z.number()),
  address: z.string().optional(),
  secretToken: z.string().optional(),
});

export const verifyPracticeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/api/verify-practice", async (request, reply) => {
    const parseResult = practiceBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.issues[0]?.message || "Invalid request body" });
    }

    const { roundId, questionIds, submittedAnswers, secretToken } = parseResult.data;

    if (questionIds.length !== submittedAnswers.length) {
      return reply.status(400).send({ error: "questionIds and submittedAnswers length mismatch" });
    }

    // Clean up session token in DB if present
    if (secretToken) {
      try {
        const db = await getDb();
        await db.query("UPDATE round_secrets SET consumed = true WHERE round_id = $1", [roundId]);
      } catch (err) {
        // Silently continue for practice rounds
      }
    }

    // Score without any blockchain interaction or leaderboard updates
    try {
      const { correctCount, total, won, correctAnswers } = scoreRound(questionIds, submittedAnswers);
      return reply.status(200).send({
        won,
        correctCount,
        total,
        txHash: null,
        correctAnswers,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to verify practice round" });
    }
  });
};
