import "dotenv/config";
import express from "express";
import verifyRound from "./api/verify-round.js";
import user from "./api/user.js";
import leaderboard from "./api/leaderboard.js";
import roundQuestions from "./api/round-questions.js";
import questionStats from "./api/question-stats.js";

import og from "./api/og.js";
import shareCard from "./api/share-card.js";

// Setup Express server and middleware
const app = express();
app.use(express.json());

app.post("/api/verify-round", verifyRound);
app.post("/api/user", user);
app.get("/api/leaderboard", leaderboard);
app.post("/api/round-questions", roundQuestions);
app.get("/api/question-stats", questionStats);
app.get("/api/og", og);
app.get("/api/share-card", shareCard);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local dev API running on http://localhost:${PORT}`);
});
