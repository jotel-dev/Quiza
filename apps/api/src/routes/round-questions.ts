import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "crypto";
import { StrKey } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { selectQuestions } from "../scoring.js";
import { getRound } from "../stellar/client.js";
import { getDb } from "../db/index.js";
import { verifyChallenge, verifySessionToken } from "../stellar/auth.js";

const bodySchema = z.object({
  roundId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  type: z.enum(["standard", "daily", "practice"]).optional().default("standard"),
  category: z.string().optional().default("Mixed"),
  difficulty: z.string().optional().default("Mixed"),
  walletAddress: z.string().optional(),
  sessionToken: z.string().optional(),
  signature: z.string().optional(),
  nonce: z.string().optional(),
});

export const roundQuestionsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/api/round-questions", async (request, reply) => {
    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.issues[0]?.message || "Invalid request body" });
    }

    const { roundId, type, category, difficulty, walletAddress, sessionToken, signature, nonce } =
      parseResult.data;
    const db = await getDb();

    // Standard and daily rounds require player authentication and checks
    if (type !== "practice") {
      if (!walletAddress || !StrKey.isValidEd25519PublicKey(walletAddress)) {
        return reply.status(400).send({ error: "Missing or invalid wallet address" });
      }

      // Security: verify session token OR cryptographic signature against challenge nonce
      const authHeader = request.headers.authorization;
      const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
      const effectiveSessionToken = sessionToken || bearerToken;

      if (effectiveSessionToken) {
        try {
          verifySessionToken(effectiveSessionToken, walletAddress);
        } catch (sessionErr: any) {
          return reply.status(401).send({ error: sessionErr.message || "Invalid or expired session token" });
        }
      } else if (signature && nonce) {
        try {
          await verifyChallenge(walletAddress, nonce, signature);
        } catch (authErr: any) {
          return reply.status(401).send({ error: authErr.message || "Authentication signature verification failed" });
        }
      } else if (process.env.NODE_ENV !== "test") {
        return reply.status(401).send({ error: "Session token or wallet signature required for non-practice rounds" });
      }

      // Daily Challenge: does NOT require on-chain stake per parity audit, but checks daily quota
      let onchainCreatedAt: Date | null = null;
      if (type === "daily") {
        const playerRes = await db.query(
          "SELECT last_daily_challenge_date FROM players WHERE address = $1",
          [walletAddress]
        );
        const todayStr = new Date().toDateString();
        if (playerRes.rows.length > 0 && playerRes.rows[0].last_daily_challenge_date === todayStr) {
          return reply.status(403).send({ error: "Daily challenge already played today" });
        }

        // Mark daily challenge played for today
        await db.query(
          `INSERT INTO players (address, username, last_daily_challenge_date, created_at, last_updated)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (address) DO UPDATE SET
             last_daily_challenge_date = EXCLUDED.last_daily_challenge_date,
             last_updated = NOW()`,
          [walletAddress, walletAddress.slice(0, 6) + "...", todayStr]
        );
      } else {
        // Standard rounds require on-chain contract round verification
        const numericRoundId = Number(roundId);
        if (isNaN(numericRoundId) || numericRoundId <= 0) {
          return reply.status(400).send({ error: "Invalid roundId: must be a positive integer" });
        }

        // Check on-chain round
        const round = await getRound(numericRoundId);
        if (!round) {
          return reply.status(404).send({ error: `Round ${roundId} does not exist on-chain` });
        }

        if (round.createdAt) {
          onchainCreatedAt = new Date(round.createdAt * 1000);
        }

        if (round.player !== walletAddress) {
          return reply.status(403).send({ error: "Round does not belong to the requesting address" });
        }

        if (round.resolved) {
          return reply.status(400).send({ error: "Round is already resolved" });
        }

        // Check 2-hour window with safety margin (300 seconds / 5 mins)
        const nowSeconds = Math.floor(Date.now() / 1000);
        const elapsed = nowSeconds - round.createdAt;
        const MAX_WINDOW = 7200 - 300; // 2 hours minus 5 min safety margin
        if (elapsed > MAX_WINDOW) {
          return reply.status(400).send({ error: "Round has expired (exceeded 2-hour window)" });
        }
      }

      // Save session in DB
      const questions = selectQuestions(config.QUIZA_ROUND_SECRET, roundId, type, category, difficulty);

      // Generate secure HMAC session token
      const hmacSig = createHash("sha256")
        .update(`${config.QUIZA_ROUND_SECRET}:${roundId}`)
        .digest("hex");
      const secretToken = `${randomUUID()}.${hmacSig}`;
      const tokenHash = createHash("sha256").update(secretToken).digest("hex");

      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours expiry

      if (walletAddress) {
        await db.query(
          `INSERT INTO round_sessions (round_id, player, token_hash, status, created_at, onchain_created_at)
           VALUES ($1, $2, $3, 'issued', NOW(), $4)
           ON CONFLICT (round_id) DO UPDATE SET
             token_hash = EXCLUDED.token_hash,
             status = 'issued',
             onchain_created_at = COALESCE(EXCLUDED.onchain_created_at, round_sessions.onchain_created_at)`,
          [roundId, walletAddress, tokenHash, onchainCreatedAt]
        );
      }

      await db.query(
        `INSERT INTO round_secrets (round_id, token, created_at, expires_at, consumed)
         VALUES ($1, $2, NOW(), $3, false)
         ON CONFLICT (round_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, consumed = false`,
        [roundId, secretToken, expiresAt]
      );

      return reply.status(200).send({ questions, secretToken });
    }

    // Practice mode
    const questions = selectQuestions(config.QUIZA_ROUND_SECRET, roundId, type, category, difficulty);
    const hmacSig = createHash("sha256")
      .update(`${config.QUIZA_ROUND_SECRET}:${roundId}`)
      .digest("hex");
    const secretToken = `${randomUUID()}.${hmacSig}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO round_secrets (round_id, token, created_at, expires_at, consumed)
       VALUES ($1, $2, NOW(), $3, false)
       ON CONFLICT (round_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, consumed = false`,
      [roundId, secretToken, expiresAt]
    );

    return reply.status(200).send({ questions, secretToken });
  });
};
