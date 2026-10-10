import { createHmac } from "crypto";

const SECRET = process.env.QUIZA_ROUND_SECRET || "quiza-secret-key-2026-production-secure";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { address } = body;

    if (!address) {
      return res.status(400).json({ error: "Missing address" });
    }

    const expiresAt = Date.now() + 15 * 60 * 1000;
    const payload = `${address}:${expiresAt}`;
    const hmac = createHmac("sha256", SECRET).update(payload).digest("hex");
    const rawObj = JSON.stringify({ address, expiresAt, hmac });
    const sessionToken = Buffer.from(rawObj, "utf-8").toString("base64url");

    return res.status(200).json({
      sessionToken,
      expiresAt,
      address,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create session" });
  }
}
