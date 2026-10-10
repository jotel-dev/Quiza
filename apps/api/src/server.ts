import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";

import { roundQuestionsRoute } from "./routes/round-questions.js";
import { verifyRoundRoute } from "./routes/verify-round.js";
import { verifyPracticeRoute } from "./routes/verify-practice.js";
import { leaderboardRoute } from "./routes/leaderboard.js";
import { userRoute } from "./routes/user.js";
import { questionStatsRoute } from "./routes/question-stats.js";
import { ogRoute } from "./routes/og.js";
import { shareCardRoute } from "./routes/share-card.js";
import { challengeRoute } from "./routes/challenge.js";
import { roundStatusRoute } from "./routes/round-status.js";
import { healthRoute } from "./routes/health.js";

export async function buildServer(opts?: { trustProxy?: any }): Promise<FastifyInstance> {
  const app = fastify({
    trustProxy: opts?.trustProxy !== undefined ? opts.trustProxy : config.TRUST_PROXY,
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
          };
        },
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return cb(null, true);
      if (
        config.ALLOWED_ORIGINS.includes("*") ||
        config.ALLOWED_ORIGINS.includes(origin) ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return cb(null, true);
      }
      return cb(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Register routes
  await app.register(healthRoute);
  await app.register(challengeRoute);
  await app.register(roundStatusRoute);
  await app.register(roundQuestionsRoute);
  await app.register(verifyRoundRoute);
  await app.register(verifyPracticeRoute);
  await app.register(leaderboardRoute);
  await app.register(userRoute);
  await app.register(questionStatsRoute);
  await app.register(ogRoute);
  await app.register(shareCardRoute);

  return app;
}
