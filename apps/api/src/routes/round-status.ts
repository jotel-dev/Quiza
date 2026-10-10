import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { verifySessionToken } from "../stellar/auth.js";

const statusQuerySchema = z.object({
  roundId: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export const roundStatusRoute: FastifyPluginAsync = async (fastify) => {
  const handler = async (request: any, reply: any) => {
    const parseResult = statusQuerySchema.safeParse({
      ...(request.params || {}),
      ...(request.query || {}),
    });
    if (!parseResult.success) {
      return reply.status(400).send({ error: "Missing or invalid roundId" });
    }

    const { roundId } = parseResult.data;

    // 1. Require Bearer session token
    const authHeader = request.headers.authorization;
    const sessionToken = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : undefined;

    if (!sessionToken) {
      return reply.status(401).send({ error: "Unauthorized: Bearer session token required" });
    }

    const db = await getDb();
    const res = await db.query(
      `SELECT * FROM round_sessions WHERE round_id = $1`,
      [roundId]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({ error: "Round session not found" });
    }

    const session = res.rows[0];

    // 2. Enforce session token bound to round's player address
    try {
      const verified = verifySessionToken(sessionToken, session.player);
      if (verified.address !== session.player) {
        return reply.status(401).send({ error: "Unauthorized: Session token address mismatch" });
      }
    } catch (authErr: any) {
      return reply.status(401).send({ error: authErr?.message || "Unauthorized: Invalid or expired session token" });
    }

    // 3. Return correctAnswers, correctCount, and txHash ONLY when status is scored or resolved
    if (session.status === "scored" || session.status === "resolved") {
      let correctAnswers = null;
      if (session.correct_answers) {
        try {
          correctAnswers = JSON.parse(session.correct_answers);
        } catch {
          correctAnswers = null;
        }
      }

      return reply.status(200).send({
        roundId: session.round_id,
        player: session.player,
        status: session.status,
        score: session.score ?? session.correct_count ?? 0,
        correctCount: session.correct_count ?? session.score ?? 0,
        total: session.total ?? 5,
        won: Boolean(session.won),
        txHash: session.resolved_tx,
        correctAnswers,
        resolved: session.status === "resolved",
        errorMessage: session.error_message,
      });
    }

    // For issued, failed, needs_attention, etc. return status only
    return reply.status(200).send({
      roundId: session.round_id,
      player: session.player,
      status: session.status,
      resolved: false,
      errorMessage: session.error_message,
    });
  };

  fastify.get("/api/round-status", handler);
  fastify.get("/api/round/:roundId", handler);
};
