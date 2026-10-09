import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";

const statusQuerySchema = z.object({
  roundId: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export const roundStatusRoute: FastifyPluginAsync = async (fastify) => {
  const handler = async (request: any, reply: any) => {
    const parseResult = statusQuerySchema.safeParse(request.query || request.params);
    if (!parseResult.success) {
      return reply.status(400).send({ error: "Missing or invalid roundId" });
    }

    const { roundId } = parseResult.data;
    const db = await getDb();
    const res = await db.query(
      `SELECT * FROM round_sessions WHERE round_id = $1`,
      [roundId]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({ error: "Round session not found" });
    }

    const session = res.rows[0];
    return reply.status(200).send({
      roundId: session.round_id,
      player: session.player,
      status: session.status,
      score: session.score ?? session.correct_count ?? 0,
      won: session.won,
      txHash: session.resolved_tx,
      resolved: session.status === "resolved",
      errorMessage: session.error_message,
    });
  };

  fastify.get("/api/round-status", handler);
  fastify.get("/api/round/:roundId", handler);
};
