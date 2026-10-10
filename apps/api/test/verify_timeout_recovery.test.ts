import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { getDb } from "../src/db/index.js";
import { createSessionToken } from "../src/stellar/auth.js";
import { Keypair } from "@stellar/stellar-sdk";

describe("Verify Round Timeout & Polling Fallback Suite", () => {
  const player = Keypair.random();
  let app: any;

  beforeAll(async () => {
    app = await buildServer({ trustProxy: 1 });
  });

  it("rejects with 401 when no session token is provided", async () => {
    const db = await getDb();
    const roundId = "no-token-round-" + Date.now();

    await db.query(
      `INSERT INTO round_sessions (round_id, player, status, created_at)
       VALUES ($1, $2, 'issued', NOW())`,
      [roundId, player.publicKey()]
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/round-status?roundId=${roundId}`,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain("Bearer session token required");
  });

  it("rejects with 401 when token belongs to another address", async () => {
    const db = await getDb();
    const roundId = "wrong-addr-round-" + Date.now();
    const otherPlayer = Keypair.random();
    const { sessionToken: otherToken } = createSessionToken(otherPlayer.publicKey());

    await db.query(
      `INSERT INTO round_sessions (round_id, player, status, created_at)
       VALUES ($1, $2, 'issued', NOW())`,
      [roundId, player.publicKey()]
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/round-status?roundId=${roundId}`,
      headers: {
        authorization: `Bearer ${otherToken}`,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain("Session token address mismatch");
  });

  it("returns status only when round status is issued (no answers, count, or txHash in payload)", async () => {
    const db = await getDb();
    const roundId = "issued-round-" + Date.now();
    const { sessionToken } = createSessionToken(player.publicKey());

    await db.query(
      `INSERT INTO round_sessions (round_id, player, status, created_at)
       VALUES ($1, $2, 'issued', NOW())`,
      [roundId, player.publicKey()]
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/round-status?roundId=${roundId}`,
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.roundId).toBe(roundId);
    expect(data.player).toBe(player.publicKey());
    expect(data.status).toBe("issued");
    expect(data.resolved).toBe(false);
    expect(data.correctAnswers).toBeUndefined();
    expect(data.correctCount).toBeUndefined();
    expect(data.score).toBeUndefined();
    expect(data.txHash).toBeUndefined();
  });

  it("happy path: recovers and returns expected Results shape via /api/round-status when resolved", async () => {
    const db = await getDb();
    const roundId = "aborted-round-" + Date.now();
    const { sessionToken } = createSessionToken(player.publicKey());

    // 1. Simulate client issuing round session and secret token
    await db.query(
      `INSERT INTO round_secrets (round_id, token, created_at, expires_at, consumed)
       VALUES ($1, 'secret-tok-123', NOW(), NOW() + INTERVAL '10 minutes', false)`,
      [roundId]
    );

    // 2. Simulate client initiating POST /api/verify-round, but client aborts / times out.
    // The backend finishes off-chain scoring and persists to DB.
    const mockCorrectAnswers = ["Paris", "Jupiter", "Oxygen", "42", "Rust"];
    await db.query(
      `INSERT INTO round_sessions (round_id, player, status, score, correct_count, total, won, correct_answers, resolved_tx, created_at)
       VALUES ($1, $2, 'resolved', 5, 5, 5, true, $3, 'tx_hash_recovered_123', NOW())`,
      [roundId, player.publicKey(), JSON.stringify(mockCorrectAnswers)]
    );

    // 3. Client begins polling GET /api/round-status (no address query parameter)
    const statusRes = await app.inject({
      method: "GET",
      url: `/api/round-status?roundId=${roundId}`,
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });

    expect(statusRes.statusCode).toBe(200);
    const data = JSON.parse(statusRes.payload);

    // Verify full result shape required by Results page
    expect(data.roundId).toBe(roundId);
    expect(data.status).toBe("resolved");
    expect(data.correctCount).toBe(5);
    expect(data.total).toBe(5);
    expect(data.won).toBe(true);
    expect(data.txHash).toBe("tx_hash_recovered_123");
    expect(Array.isArray(data.correctAnswers)).toBe(true);
    expect(data.correctAnswers).toEqual(mockCorrectAnswers);
  });
});
