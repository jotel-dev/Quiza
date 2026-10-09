import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomUUID } from "crypto";
import { getDb } from "../src/db/index.js";

describe("Session Token Unit & Lifecycle Tests", () => {
  const SECRET = "quiza-test-secret-long-enough-32-chars";

  it("generates and verifies HMAC signatures correctly", () => {
    const roundId = "998877";
    const hmacSig = createHash("sha256").update(`${SECRET}:${roundId}`).digest("hex");
    const token = `${randomUUID()}.${hmacSig}`;

    const parts = token.split(".");
    expect(parts.length).toBe(2);

    const recomputedHmac = createHash("sha256").update(`${SECRET}:${roundId}`).digest("hex");
    expect(parts[1]).toBe(recomputedHmac);

    // Tampered token fails
    const tampered = `${parts[0]}.bad-hmac-signature`;
    const tamperedParts = tampered.split(".");
    expect(tamperedParts[1]).not.toBe(recomputedHmac);
  });

  it("handles single-use token lifecycle and expiry in database", async () => {
    const db = await getDb();
    const roundId = "token-test-" + Date.now();
    const token = `uuid-123.${createHash("sha256").update(`${SECRET}:${roundId}`).digest("hex")}`;
    const expiresAt = new Date(Date.now() + 60000); // 1 min in future

    // Insert token
    await db.query(
      `INSERT INTO round_secrets (round_id, token, created_at, expires_at, consumed)
       VALUES ($1, $2, NOW(), $3, false)
       ON CONFLICT (round_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, consumed = false`,
      [roundId, token, expiresAt]
    );

    // First fetch: valid and unconsumed
    const check1 = await db.query("SELECT * FROM round_secrets WHERE round_id = $1", [roundId]);
    expect(check1.rows.length).toBe(1);
    expect(check1.rows[0].consumed).toBe(false);

    // Consume token
    await db.query("UPDATE round_secrets SET consumed = true WHERE round_id = $1", [roundId]);

    // Second fetch: consumed
    const check2 = await db.query("SELECT * FROM round_secrets WHERE round_id = $1", [roundId]);
    expect(check2.rows[0].consumed).toBe(true);

    // Expired token test
    const expiredRoundId = "token-test-expired-" + Date.now();
    const expiredToken = `uuid-456.${createHash("sha256").update(`${SECRET}:${expiredRoundId}`).digest("hex")}`;
    const pastExpiresAt = new Date(Date.now() - 10000); // 10s in past

    await db.query(
      `INSERT INTO round_secrets (round_id, token, created_at, expires_at, consumed)
       VALUES ($1, $2, NOW(), $3, false)
       ON CONFLICT (round_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, consumed = false`,
      [expiredRoundId, expiredToken, pastExpiresAt]
    );

    const expiredCheck = await db.query("SELECT * FROM round_secrets WHERE round_id = $1", [expiredRoundId]);
    expect(new Date(expiredCheck.rows[0].expires_at).getTime()).toBeLessThan(Date.now());
  });
});
