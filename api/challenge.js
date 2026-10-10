import { randomUUID } from "crypto";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { address } = req.query || {};
  if (!address) {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  const nonce = randomUUID();
  const message = `Quiza Authentication Nonce: ${nonce} for ${address}`;
  const expiresAt = Date.now() + 5 * 60 * 1000;

  return res.status(200).json({
    nonce,
    message,
    expiresAt,
  });
}
