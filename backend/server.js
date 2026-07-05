import "dotenv/config";
import express from "express";
import { verifyAndResolve } from "./verifyRound.js";

const app = express();
app.use(express.json());

import db from "./db.js";

const clients = new Set();

function getLeaderboardData() {
  const stmt = db.prepare(`
    SELECT *, (correctAnswers * 100.0 / NULLIF(totalQuestions, 0)) as accuracy
    FROM players 
    WHERE gamesPlayed > 0 
    ORDER BY totalPoints DESC, accuracy DESC, lastUpdated ASC 
    LIMIT 20
  `);
  return stmt.all();
}

function broadcastLeaderboard() {
  const data = getLeaderboardData();
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(message);
  }
}

app.get("/api/leaderboard/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.add(res);

  // Send initial data immediately
  res.write(`data: ${JSON.stringify(getLeaderboardData())}\n\n`);

  req.on("close", () => {
    clients.delete(res);
  });
});

app.post("/api/user", (req, res) => {
  const { address, username } = req.body;
  if (!address || !username) {
    return res.status(400).json({ error: "Missing address or username" });
  }

  const stmt = db.prepare(`
    INSERT INTO players (address, username, lastUpdated) 
    VALUES (@address, @username, @now)
    ON CONFLICT(address) DO UPDATE SET username = @username, lastUpdated = @now
  `);
  
  stmt.run({ address, username, now: Date.now() });
  broadcastLeaderboard();
  res.json({ success: true });
});

app.get("/api/leaderboard/:address", (req, res) => {
  const stmt = db.prepare(`
    WITH RankedPlayers AS (
      SELECT *, (correctAnswers * 100.0 / NULLIF(totalQuestions, 0)) as accuracy,
      RANK() OVER (ORDER BY totalPoints DESC, (correctAnswers * 100.0 / NULLIF(totalQuestions, 0)) DESC, lastUpdated ASC) as rank
      FROM players
      WHERE gamesPlayed > 0
    )
    SELECT * FROM RankedPlayers WHERE address = ?
  `);
  const userRank = stmt.get(req.params.address);
  if (userRank) {
    res.json(userRank);
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

app.post("/api/verify-round", async (req, res) => {
  try {
    const result = await verifyAndResolve(req.body);
    // Broadcast updates to connected clients after scoring
    broadcastLeaderboard();
    res.json(result);
  } catch (err) {
    console.error("Verification error:", err);
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Quiza backend running on http://localhost:${PORT}`);
});
