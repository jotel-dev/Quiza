import { FastifyPluginAsync } from "fastify";
import { loadQuestionBank } from "../scoring.js";

export const questionStatsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/question-stats", async (_request, reply) => {
    try {
      const bank = loadQuestionBank();
      const stats: {
        total: number;
        categories: Record<string, { easy: number; medium: number; hard: number; mixed: number }>;
      } = {
        total: bank.questions.length,
        categories: {
          Mixed: { easy: 0, medium: 0, hard: 0, mixed: bank.questions.length },
        },
      };

      bank.questions.forEach((q) => {
        if (!stats.categories[q.category]) {
          stats.categories[q.category] = { easy: 0, medium: 0, hard: 0, mixed: 0 };
        }
        const diff = q.difficulty as "easy" | "medium" | "hard";
        if (stats.categories[q.category][diff] !== undefined) {
          stats.categories[q.category][diff]++;
        }
        stats.categories[q.category].mixed++;

        if (stats.categories.Mixed[diff] !== undefined) {
          stats.categories.Mixed[diff]++;
        }
      });

      return reply.status(200).send(stats);
    } catch (err: any) {
      return reply.status(500).send({ error: "Failed to load question stats" });
    }
  });
};
