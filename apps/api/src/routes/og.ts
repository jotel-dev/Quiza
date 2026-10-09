import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

function escapeXml(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const ogQuerySchema = z.object({
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

export const ogRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/og", async (request, reply) => {
    const query = ogQuerySchema.parse(request.query || {});

    const isWin = query.won === "true";
    const safeScore = escapeXml(query.score);
    const safeTotal = escapeXml(query.total);
    const safeMultiplier = escapeXml(query.multiplier);
    const safePayout = escapeXml(query.payout);
    const safeToken = escapeXml(query.token);
    const safeUsername = escapeXml(query.username);
    const safeRank = escapeXml(query.rank);

    const titleText = isWin
      ? `I just won ${safeMultiplier} my stake on Quiza! 🎉`
      : `I scored ${safeScore}/${safeTotal} on Quiza! 🧠`;

    const subText =
      isWin && safePayout && safePayout !== "null"
        ? `Earned +${safePayout} ${safeToken} on Stellar`
        : safeRank
        ? `Ranked #${safeRank} on the Global Leaderboard`
        : `Can you beat my score?`;

    const bgGradientStart = isWin ? "#1E1B4B" : "#0F172A";
    const bgGradientEnd = isWin ? "#312E81" : "#1E293B";
    const accentColor = isWin ? "#F59E0B" : "#4F46E5";
    const badgeBg = isWin ? "#FEF3C7" : "#EEF2FF";
    const badgeText = isWin ? "#92400E" : "#3730A3";

    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradientStart}" />
      <stop offset="100%" stop-color="${bgGradientEnd}" />
    </linearGradient>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#FBBF24" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Glowing Orbs -->
  <circle cx="150" cy="120" r="220" fill="${accentColor}" opacity="0.25" filter="blur(60px)"/>
  <circle cx="1050" cy="500" r="250" fill="#10B981" opacity="0.2" filter="blur(70px)"/>

  <!-- Main Card Container -->
  <rect x="80" y="70" width="1040" height="490" rx="36" fill="url(#cardBg)" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2" filter="url(#shadow)"/>

  <!-- Top Header Badge -->
  <g transform="translate(130, 130)">
    <rect width="180" height="46" rx="23" fill="${badgeBg}"/>
    <text x="90" y="29" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="800" fill="${badgeText}" text-anchor="middle">QUIZA TRIVIA</text>
  </g>

  <!-- Player Name / Rank -->
  <text x="1070" y="160" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" fill="#94A3B8" text-anchor="end">
    ${safeUsername ? `Player: ${safeUsername}` : "Quiza on Stellar"}
  </text>

  <!-- Main Headline -->
  <text x="130" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF">
    ${escapeXml(titleText)}
  </text>
  <text x="130" y="285" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#CBD5E1">
    ${escapeXml(subText)}
  </text>

  <!-- Stat Cards Grid -->
  <!-- Score Stat Box -->
  <g transform="translate(130, 340)">
    <rect width="260" height="160" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15"/>
    <text x="30" y="60" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#94A3B8">SCORE</text>
    <text x="30" y="125" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" fill="#10B981">${safeScore}/${safeTotal}</text>
  </g>

  <!-- Multiplier Stat Box -->
  <g transform="translate(420, 340)">
    <rect width="260" height="160" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15"/>
    <text x="30" y="60" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#94A3B8">MULTIPLIER</text>
    <text x="30" y="125" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" fill="#F59E0B">${safeMultiplier}</text>
  </g>

  <!-- Network / Platform Box -->
  <g transform="translate(710, 340)">
    <rect width="360" height="160" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15"/>
    <text x="30" y="60" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#94A3B8">BUILT ON STELLAR</text>
    <text x="30" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="800" fill="#FFFFFF">Freighter</text>
  </g>

  <!-- Bottom CTA Banner -->
  <text x="600" y="590" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#94A3B8" text-anchor="middle">
    Play &amp; Stake on Quiza • quiza.vercel.app
  </text>
</svg>
    `.trim();

    reply.header("Content-Type", "image/svg+xml");
    reply.header("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return reply.status(200).send(svg);
  });
};
