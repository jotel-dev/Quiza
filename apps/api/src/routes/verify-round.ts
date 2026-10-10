import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createHash } from "crypto";
import { StrKey } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { scoreRound } from "../scoring.js";
import { getDb } from "../db/index.js";
import {
  resolveRoundOnChain,
  AlreadyResolvedError,
  InsufficientPoolLiquidityError,
} from "../stellar/verifier.js";
import { getRound } from "../stellar/client.js";
import { verifyChallenge, verifySessionToken } from "../stellar/auth.js";
import { processResolveWithRetry } from "../stellar/retry.js";

const verifyBodySchema = z.object({
  roundId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  questionIds: z.array(z.string()),
  submittedAnswers: z.array(z.number()),
  address: z.string(),
  secretToken: z.string(),
  sessionToken: z.string().optional(),
  signature: z.string().optional(),
  nonce: z.string().optional(),
});

export const verifyRoundRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/api/verify-round", async (request, reply) => {
    const parseResult = verifyBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.issues[0]?.message || "Invalid request body" });
    }

    const { roundId, questionIds, submittedAnswers, address, secretToken, sessionToken, signature, nonce } =
      parseResult.data;

    if (!StrKey.isValidEd25519PublicKey(address)) {
      return reply.status(400).send({ error: "Missing or invalid player address" });
    }

    if (questionIds.length !== submittedAnswers.length) {
      return reply.status(400).send({ error: "questionIds and submittedAnswers length mismatch" });
    }

    // Security: verify session token OR cryptographic signature against challenge nonce
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    const effectiveSessionToken = sessionToken || bearerToken;

    if (effectiveSessionToken) {
      try {
        verifySessionToken(effectiveSessionToken, address);
      } catch (sessionErr: any) {
        return reply.status(401).send({ error: sessionErr.message || "Invalid or expired session token" });
      }
    } else if (signature && nonce) {
      try {
        await verifyChallenge(address, nonce, signature);
      } catch (authErr: any) {
        return reply.status(401).send({ error: authErr.message || "Authentication signature verification failed" });
      }
    } else if (process.env.NODE_ENV !== "test") {
      return reply.status(401).send({ error: "Session token or wallet signature required to verify round" });
    }

    const db = await getDb();

    // Idempotency check: if this round was already scored and resolved, return saved result immediately
    const existingSession = await db.query(
      "SELECT * FROM round_sessions WHERE round_id = $1",
      [roundId]
    );

    if (existingSession.rows.length > 0) {
      const session = existingSession.rows[0];
      if (session.status === "resolved") {
        const { correctAnswers } = scoreRound(questionIds, submittedAnswers);
        return reply.status(200).send({
          won: session.won,
          correctCount: session.correct_count,
          total: session.total,
          txHash: session.resolved_tx,
          correctAnswers,
        });
      }
    }

    // Token validation:
    // 1. Check HMAC signature
    const expectedHmac = createHash("sha256")
      .update(`${config.QUIZA_ROUND_SECRET}:${roundId}`)
      .digest("hex");
    const parts = secretToken.split(".");
    const isValidHmac =
      (parts.length === 2 && parts[1] === expectedHmac) || secretToken === expectedHmac;

    if (!isValidHmac) {
      return reply.status(400).send({ error: "Invalid or expired round session token" });
    }

    // 2. Check and consume single-use token in DB
    const secretRow = await db.query(
      "SELECT * FROM round_secrets WHERE round_id = $1",
      [roundId]
    );

    if (secretRow.rows.length === 0) {
      return reply.status(400).send({ error: "Round session not found or expired" });
    }

    const secretData = secretRow.rows[0];
    if (secretData.consumed) {
      return reply.status(400).send({ error: "Round session token already used" });
    }

    const now = new Date();
    if (new Date(secretData.expires_at) < now) {
      return reply.status(400).send({ error: "Round session token has expired" });
    }

    // Mark token as consumed
    await db.query(
      "UPDATE round_secrets SET consumed = true WHERE round_id = $1",
      [roundId]
    );

    // Score answers off-chain
    let scoring;
    try {
      scoring = scoreRound(questionIds, submittedAnswers);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || "Failed to score round" });
    }

    const { correctCount, total, won, correctAnswers } = scoring;

    // STEP 3 REQUIREMENT: Persist score first BEFORE sending resolve!
    await db.query(
      `INSERT INTO round_sessions (round_id, player, status, score, correct_count, total, won, correct_answers, created_at)
       VALUES ($1, $2, 'scored', $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (round_id) DO UPDATE SET
         status = 'scored',
         score = EXCLUDED.score,
         correct_count = EXCLUDED.correct_count,
         total = EXCLUDED.total,
         won = EXCLUDED.won,
         correct_answers = EXCLUDED.correct_answers`,
      [roundId, address, correctCount, correctCount, total, won, JSON.stringify(correctAnswers)]
    );

    // Verify round on-chain before resolving
    const onChain = await getRound(roundId);
    if (!onChain) {
      return reply.status(400).send({ error: "Round does not exist on-chain" });
    }
    if (onChain.player !== address) {
      return reply.status(403).send({ error: "Round does not belong to the submitting address" });
    }

    if (onChain.createdAt) {
      await db.query(
        `UPDATE round_sessions SET onchain_created_at = COALESCE(onchain_created_at, $1) WHERE round_id = $2`,
        [new Date(onChain.createdAt * 1000), roundId]
      );
    }

    let txHash: string | null = null;
    if (!onChain.resolved) {
      try {
        txHash = await resolveRoundOnChain(roundId, won, correctCount);
      } catch (err: any) {
        let errMessage = err?.message || "Failed to resolve round on-chain";
        if (err instanceof AlreadyResolvedError) {
          errMessage = "Round already resolved on-chain";
        } else if (err instanceof InsufficientPoolLiquidityError) {
          errMessage = "Contract liquidity pool has insufficient funds to pay reward";
        }

        // STEP 3 REQUIREMENT: If the chain call fails, mark the row failed/scored and retry automatically with backoff
        await db.query(
          `UPDATE round_sessions SET status = 'failed', error_message = $1 WHERE round_id = $2`,
          [errMessage, roundId]
        );

        // Trigger automatic background retry without needing a new token
        processResolveWithRetry(roundId, won, correctCount, address, total).catch((retryErr) =>
          console.error(`[quiza-api] Background retry error for ${roundId}:`, retryErr.message)
        );

        // If it's a hard contract revert (like InsufficientPoolLiquidity or bad param), return error
        if (err instanceof InsufficientPoolLiquidityError || err instanceof AlreadyResolvedError) {
          return reply.status(400).send({ error: errMessage });
        }

        // For transient errors, return response indicating pending on-chain resolution
        return reply.status(200).send({
          won,
          correctCount,
          total,
          txHash: null,
          correctAnswers,
          pendingResolution: true,
        });
      }
    }

    // Update round session in DB to resolved
    await db.query(
      `UPDATE round_sessions
       SET status = 'resolved', resolved_tx = $1, resolved_at = NOW(), error_message = NULL
       WHERE round_id = $2`,
      [txHash, roundId]
    );

    // Update player leaderboard statistics in DB
    const pointsEarned = correctCount * 10;
    const isWin = won ? 1 : 0;

    await db.query(
      `INSERT INTO players (address, username, total_points, correct_answers, total_questions, games_played, streak, created_at, last_updated)
       VALUES ($1, $2, $3, $4, $5, 1, $6, NOW(), NOW())
       ON CONFLICT (address) DO UPDATE SET
         total_points = players.total_points + EXCLUDED.total_points,
         correct_answers = players.correct_answers + EXCLUDED.correct_answers,
         total_questions = players.total_questions + EXCLUDED.total_questions,
         games_played = players.games_played + 1,
         streak = CASE WHEN $7 = 1 THEN players.streak + 1 ELSE 0 END,
         last_updated = NOW()`,
      [
        address,
        address.slice(0, 6) + "...",
        pointsEarned,
        correctCount,
        total,
        isWin,
        isWin,
      ]
    );

    return reply.status(200).send({
      won,
      correctCount,
      total,
      txHash,
      correctAnswers,
    });
  });
};
