import "dotenv/config";
import express from "express";
import verifyRound from "./api/verify-round.js";
import user from "./api/user.js";

const app = express();
app.use(express.json());

app.post("/api/verify-round", verifyRound);
app.post("/api/user", user);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local dev API running on http://localhost:${PORT}`);
});
