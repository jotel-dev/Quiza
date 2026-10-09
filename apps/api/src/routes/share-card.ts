import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { config } from "../config.js";

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"'/`]/g, (m) => {
    switch (m) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      case "/":
        return "&#x2F;";
      case "`":
        return "&#x60;";
      default:
        return m;
    }
  });
}

const shareQuerySchema = z.object({
  score: z.coerce.number().min(0).max(100).catch(9).transform(String),
  total: z.coerce.number().min(1).max(100).catch(10).transform(String),
  multiplier: z
    .string()
    .regex(/^[0-9.]+[xX]?$/)
    .catch("1.5x"),
  payout: z
    .string()
    .regex(/^[0-9.]+$/)
    .catch("0.015"),
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,12}$/)
    .catch("XLM"),
  username: z.string().max(100).catch("Player"),
  rank: z
    .string()
    .regex(/^[0-9]*$/)
    .catch(""),
  won: z.enum(["true", "false"]).catch("true"),
});

export const shareCardRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/share-card", async (request, reply) => {
    const query = shareQuerySchema.parse(request.query || {});
    const isWin = query.won === "true";

    const proto = (request.headers["x-forwarded-proto"] as string) || "https";
    const host = request.headers.host || "quiza.app";
    // Prefer PUBLIC_BASE_URL over Host header
    const baseUrl = config.PUBLIC_BASE_URL || `${proto}://${host}`;

    const safeScore = escapeHtml(query.score);
    const safeTotal = escapeHtml(query.total);
    const safeMultiplier = escapeHtml(query.multiplier);
    const safePayout = escapeHtml(query.payout);
    const safeToken = escapeHtml(query.token);
    const safeUsername = escapeHtml(query.username);
    const safeRank = escapeHtml(query.rank);

    const ogParams = new URLSearchParams({
      score: safeScore,
      total: safeTotal,
      multiplier: safeMultiplier,
      payout: safePayout,
      token: safeToken,
      username: safeUsername,
      rank: safeRank,
      won: String(isWin),
    }).toString();

    const ogImageUrl = `${baseUrl}/api/og?${ogParams}`;

    const rawTitle = isWin
      ? `I just won ${safeMultiplier} my stake scoring ${safeScore}/${safeTotal} on Quiza!`
      : `I scored ${safeScore}/${safeTotal} on Quiza Web3 Trivia!`;

    const rawDescription =
      isWin && safePayout && safePayout !== "null"
        ? `I earned +${safePayout} ${safeToken} on Stellar! Think you can beat my score? Play Quiza now.`
        : safeRank
        ? `Currently ranked #${safeRank} on the global Quiza leaderboard! Play & win on Stellar.`
        : `Play Web3 Trivia on Stellar & earn rewards on Quiza. Can you beat my high score?`;

    const safeTitle = escapeHtml(rawTitle);
    const safeDescription = escapeHtml(rawDescription);
    const safeBaseUrl = escapeHtml(baseUrl);
    const safeOgImageUrl = escapeHtml(ogImageUrl);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>

  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safeBaseUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeOgImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter / X Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeOgImageUrl}">

  <!-- Automatic redirect for human visitors -->
  <script>
    window.location.href = ${JSON.stringify(baseUrl)};
  </script>
</head>
<body style="font-family: system-ui, sans-serif; background: #0F172A; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <h2>${safeTitle}</h2>
    <p>${safeDescription}</p>
    <a href="${safeBaseUrl}" style="color: #6366F1; text-decoration: none; font-weight: bold;">Click here to play Quiza</a>
  </div>
</body>
</html>`;

    reply.header("Content-Type", "text/html");
    return reply.status(200).send(html);
  });
};
