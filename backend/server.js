import express from "express";
import { verifyAndResolve } from "./verifyRound.js";

const app = express();
app.use(express.json());

app.post("/api/verify-round", async (req, res) => {
  try {
    const result = await verifyAndResolve(req.body);
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
