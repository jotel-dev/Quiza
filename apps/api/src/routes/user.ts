import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";
import { getDb } from "../db/index.js";

const userBodySchema = z.object({
  address: z.string(),
  username: z.string().trim().min(1, "Username cannot be empty").max(20, "Username must be 20 chars max"),
});

export const userRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/api/user",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parseResult = userBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: parseResult.error.issues[0]?.message || "Invalid request body" });
      }

      const { address, username } = parseResult.data;

      // Validate Stellar Ed25519 public key format
      if (!StrKey.isValidEd25519PublicKey(address)) {
        return reply.status(400).send({ error: "Invalid Stellar wallet address" });
      }

      // Sanitize username (alphanumeric, spaces, underscores, dashes)
      const cleanUsername = username.replace(/[^\w\s-]/g, "").slice(0, 20).trim();
      if (!cleanUsername) {
        return reply.status(400).send({ error: "Username contains invalid characters" });
      }

      try {
        const db = await getDb();
        await db.query(
          `INSERT INTO players (address, username, total_points, correct_answers, total_questions, games_played, streak, created_at, last_updated)
           VALUES ($1, $2, 0, 0, 0, 0, 0, NOW(), NOW())
           ON CONFLICT (address) DO UPDATE SET
             username = EXCLUDED.username,
             last_updated = NOW()`,
          [address, cleanUsername]
        );

        return reply.status(200).send({ success: true });
      } catch (err: any) {
        request.log.error(err, "Failed to update user");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
};
