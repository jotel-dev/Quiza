import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createChallenge, verifyChallenge, createSessionToken } from "../stellar/auth.js";

const challengeQuerySchema = z.object({
  address: z.string(),
});

const sessionBodySchema = z.object({
  address: z.string(),
  nonce: z.string(),
  signature: z.string(),
});

export const challengeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/challenge", async (request, reply) => {
    const parseResult = challengeQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: "Missing or invalid wallet address query parameter" });
    }

    const { address } = parseResult.data;

    try {
      const challenge = await createChallenge(address);
      return reply.status(200).send(challenge);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to generate challenge" });
    }
  });

  fastify.post("/api/session", async (request, reply) => {
    const parseResult = sessionBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: "Missing or invalid session creation parameters" });
    }

    const { address, nonce, signature } = parseResult.data;

    try {
      // 1. Verify single-use nonce and cryptographic signature
      await verifyChallenge(address, nonce, signature);

      // 2. Issue 15-minute address-bound HMAC session token
      const session = createSessionToken(address);
      return reply.status(200).send(session);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message || "Failed to authenticate session" });
    }
  });
};
