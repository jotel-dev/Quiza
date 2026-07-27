function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return m;
    }
  });
}

export default function handler(req, res) {
  const {
    score = "9",
    total = "10",
    multiplier = "1.5x",
    payout = "0.015",
    token = "CELO",
    username = "Player",
    rank = "",
    won = "true",
  } = req.query;

  const isWin = won === "true" || won === true;
  const host = req.headers.host || "quiza.vercel.app";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${host}`;

  const ogImageUrl = `${baseUrl}/api/og?score=${encodeURIComponent(score)}&total=${encodeURIComponent(total)}&multiplier=${encodeURIComponent(multiplier)}&payout=${encodeURIComponent(payout)}&token=${encodeURIComponent(token)}&username=${encodeURIComponent(username)}&rank=${encodeURIComponent(rank)}&won=${encodeURIComponent(won)}`;

  const safeScore = escapeHtml(score);
  const safeTotal = escapeHtml(total);
  const safeMultiplier = escapeHtml(multiplier);
  const safePayout = escapeHtml(payout);
  const safeToken = escapeHtml(token);
  const safeRank = escapeHtml(rank);
  const safeBaseUrl = escapeHtml(baseUrl);
  const safeOgImageUrl = escapeHtml(ogImageUrl);

  const rawTitle = isWin
    ? `I just won ${multiplier} my stake scoring ${score}/${total} on Quiza!`
    : `I scored ${score}/${total} on Quiza Web3 Trivia!`;

  const rawDescription = isWin && payout && payout !== "null"
    ? `I earned +${payout} ${token} on Celo! Think you can beat my score? Play Quiza now.`
    : rank ? `Currently ranked #${rank} on the global Quiza leaderboard! Play & win on Celo.` : `Play Web3 Trivia on Celo & earn rewards on Quiza. Can you beat my high score?`;

  const safeTitle = escapeHtml(rawTitle);
  const safeDescription = escapeHtml(rawDescription);

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

  res.setHeader("Content-Type", "text/html");
  res.status(200).send(html);
}
