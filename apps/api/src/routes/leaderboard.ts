import { FastifyPluginAsync } from "fastify";
import { getDb } from "../db/index.js";

export const leaderboardRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/leaderboard", async (request, reply) => {
    try {
      const db = await getDb();
      const res = await db.query(
        `SELECT address, username, total_points, correct_answers, total_questions, games_played, streak, last_updated
         FROM players
         ORDER BY total_points DESC
         LIMIT 50`
      );

      const players = res.rows.map((row) => ({
        address: row.address,
        username: row.username,
        totalPoints: Number(row.total_points ?? 0),
        correctAnswers: Number(row.correct_answers ?? 0),
        totalQuestions: Number(row.total_questions ?? 0),
        gamesPlayed: Number(row.games_played ?? 0),
        streak: Number(row.streak ?? 0),
        lastUpdated: row.last_updated ? new Date(row.last_updated).getTime() : Date.now(),
      }));

      return reply.status(200).send({ players });
    } catch (err: any) {
      request.log.error(err, "Failed to fetch leaderboard");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
};
