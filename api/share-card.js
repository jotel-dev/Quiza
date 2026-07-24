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

  const title = isWin
    ? `I just won ${multiplier} my stake scoring ${score}/${total} on Quiza!`
    : `I scored ${score}/${total} on Quiza Web3 Trivia!`;

  const description = isWin && payout && payout !== "null"
    ? `I earned +${payout} ${token} on Celo! Think you can beat my score? Play Quiza now.`
    : rank ? `Currently ranked #${rank} on the global Quiza leaderboard! Play & win on Celo.` : `Play Web3 Trivia on Celo & earn rewards on Quiza. Can you beat my high score?`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter / X Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Automatic redirect for human visitors -->
  <script>
    window.location.href = "${baseUrl}";
  </script>
</head>
<body style="font-family: system-ui, sans-serif; background: #0F172A; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <h2>${title}</h2>
    <p>${description}</p>
    <a href="${baseUrl}" style="color: #6366F1; text-decoration: none; font-weight: bold;">Click here to play Quiza</a>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.status(200).send(html);
}
