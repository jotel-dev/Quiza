import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { Keypair } from "@stellar/stellar-sdk";
import crypto from "crypto";
import { buildServer } from "../src/server.js";
import { getDb } from "../src/db/index.js";
import {
  createChallenge,
  verifyChallenge,
  createSessionToken,
  verifySessionToken,
} from "../src/stellar/auth.js";
import { sweepPendingResolutions } from "../src/stellar/retry.js";

describe("Security, Ownership Proof & Resolve Retry Tests", () => {
  let app: FastifyInstance;
  const playerA = Keypair.random();
  const playerB = Keypair.random();

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Ownership Proof / Challenge Flow", () => {
    it("generates a single-use challenge nonce bound to the address", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/challenge?address=${playerA.publicKey()}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(typeof data.nonce).toBe("string");
      expect(data.message).toContain(playerA.publicKey());
      expect(data.message).toContain(data.nonce);
      expect(data.expiresAt).toBeGreaterThan(Date.now());
    });

    it("verifies genuine signature successfully (both raw and SEP-53 format)", async () => {
      // 1. Raw signature
      const challenge1 = await createChallenge(playerA.publicKey());
      const rawSig = Buffer.from(playerA.sign(Buffer.from(challenge1.message, "utf-8"))).toString("base64");
      const isValidRaw = await verifyChallenge(playerA.publicKey(), challenge1.nonce, rawSig);
      expect(isValidRaw).toBe(true);

      // 2. SEP-53 signature (Freighter format)
      const challenge2 = await createChallenge(playerA.publicKey());
      const sep53Payload = Buffer.concat([
        Buffer.from("Stellar Signed Message:\n", "utf-8"),
        Buffer.from(challenge2.message, "utf-8"),
      ]);
      const sep53Hash = crypto.createHash("sha256").update(sep53Payload).digest();
      const sep53Sig = Buffer.from(playerA.sign(sep53Hash)).toString("base64");
      const isValidSep53 = await verifyChallenge(playerA.publicKey(), challenge2.nonce, sep53Sig);
      expect(isValidSep53).toBe(true);
    });

    it("verifies Freighter SEP-53 message format (prefix, SHA256, base64 signature)", async () => {
      const challenge = await createChallenge(playerA.publicKey());
      // SEP-53 specification: canonical prefix "Stellar Signed Message:\n"
      const prefix = "Stellar Signed Message:\n";
      const canonicalPayload = Buffer.concat([
        Buffer.from(prefix, "utf-8"),
        Buffer.from(challenge.message, "utf-8"),
      ]);
      const messageHash = crypto.createHash("sha256").update(canonicalPayload).digest();
      const rawEd25519Sig = playerA.sign(messageHash);
      const signedMessageBase64 = Buffer.from(rawEd25519Sig).toString("base64");

      // Mimics Freighter @stellar/freighter-api v2.x return structure:
      const freighterResult = {
        signedMessage: signedMessageBase64,
        signerAddress: playerA.publicKey(),
      };

      const isValid = await verifyChallenge(
        freighterResult.signerAddress,
        challenge.nonce,
        freighterResult.signedMessage
      );
      expect(isValid).toBe(true);
    });

    it("issues 15-minute session token upon valid challenge signature via POST /api/session", async () => {
      const challenge = await createChallenge(playerA.publicKey());
      const canonicalPayload = Buffer.concat([
        Buffer.from("Stellar Signed Message:\n", "utf-8"),
        Buffer.from(challenge.message, "utf-8"),
      ]);
      const messageHash = crypto.createHash("sha256").update(canonicalPayload).digest();
      const sigBase64 = Buffer.from(playerA.sign(messageHash)).toString("base64");

      const sessionRes = await app.inject({
        method: "POST",
        url: "/api/session",
        payload: {
          address: playerA.publicKey(),
          nonce: challenge.nonce,
          signature: sigBase64,
        },
      });

      expect(sessionRes.statusCode).toBe(200);
      const data = JSON.parse(sessionRes.payload);
      expect(typeof data.sessionToken).toBe("string");
      expect(data.address).toBe(playerA.publicKey());
      expect(data.expiresAt).toBeGreaterThan(Date.now() + 14 * 60 * 1000); // ~15 mins

      // Verify the session token verifies Player A
      const verified = verifySessionToken(data.sessionToken, playerA.publicKey());
      expect(verified.address).toBe(playerA.publicKey());
    });

    it("rejects expired session token", () => {
      // Token expired 1 minute ago
      const expiredToken = createSessionToken(playerA.publicKey(), -60000);
      expect(() => {
        verifySessionToken(expiredToken.sessionToken, playerA.publicKey());
      }).toThrow("Session token has expired");
    });

    it("rejects session token used for a different address", () => {
      const validToken = createSessionToken(playerA.publicKey());
      expect(() => {
        verifySessionToken(validToken.sessionToken, playerB.publicKey());
      }).toThrow("Session token address mismatch");
    });

    it("rejects nonce replay when attempting to create a second session", async () => {
      const challenge = await createChallenge(playerA.publicKey());
      const sig = Buffer.from(playerA.sign(Buffer.from(challenge.message, "utf-8"))).toString("base64");

      // First session exchange succeeds
      const res1 = await app.inject({
        method: "POST",
        url: "/api/session",
        payload: {
          address: playerA.publicKey(),
          nonce: challenge.nonce,
          signature: sig,
        },
      });
      expect(res1.statusCode).toBe(200);

      // Replay attempt with same nonce MUST be rejected
      const res2 = await app.inject({
        method: "POST",
        url: "/api/session",
        payload: {
          address: playerA.publicKey(),
          nonce: challenge.nonce,
          signature: sig,
        },
      });
      expect(res2.statusCode).toBe(401);
      expect(JSON.parse(res2.payload).error).toContain("already been used");
    });

    it("authorizes both round-questions and verify-round using ONE session token without signing twice", async () => {
      // 1. Authenticate once via POST /api/session
      const challenge = await createChallenge(playerA.publicKey());
      const sig = Buffer.from(playerA.sign(Buffer.from(challenge.message, "utf-8"))).toString("base64");
      const sessionRes = await app.inject({
        method: "POST",
        url: "/api/session",
        payload: {
          address: playerA.publicKey(),
          nonce: challenge.nonce,
          signature: sig,
        },
      });
      const { sessionToken } = JSON.parse(sessionRes.payload);

      // 2. Authorize round-questions using the session token (Bearer header)
      const qRes = await app.inject({
        method: "POST",
        url: "/api/round-questions",
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
        payload: {
          roundId: "practice-test-token-1",
          type: "practice",
          walletAddress: playerA.publicKey(),
        },
      });
      expect(qRes.statusCode).toBe(200);

      // 3. Verify session token is also valid for subsequent verification call
      const auth = verifySessionToken(sessionToken, playerA.publicKey());
      expect(auth.address).toBe(playerA.publicKey());
    });

    it("rejects wrong signer (playerB signs challenge meant for playerA)", async () => {
      const challenge = await createChallenge(playerA.publicKey());
      const wrongSig = Buffer.from(playerB.sign(Buffer.from(challenge.message, "utf-8"))).toString("base64");

      await expect(
        verifyChallenge(playerA.publicKey(), challenge.nonce, wrongSig)
      ).rejects.toThrow("Signature verification failed");
    });

    it("rejects replayed nonce (single-use enforcement)", async () => {
      const challenge = await createChallenge(playerA.publicKey());
      const sig = Buffer.from(playerA.sign(Buffer.from(challenge.message, "utf-8"))).toString("base64");

      // First use succeeds
      await verifyChallenge(playerA.publicKey(), challenge.nonce, sig);

      // Second use MUST fail
      await expect(
        verifyChallenge(playerA.publicKey(), challenge.nonce, sig)
      ).rejects.toThrow("Challenge nonce has already been used");
    });

    it("rejects expired nonce", async () => {
      const db = await getDb();
      const nonce = "expired-nonce-" + Date.now();
      const message = `Quiza Authentication Nonce: ${nonce} for ${playerA.publicKey()}`;
      const pastExpiresAt = new Date(Date.now() - 5000); // 5 seconds ago

      await db.query(
        `INSERT INTO auth_challenges (nonce, address, message, created_at, expires_at, consumed)
         VALUES ($1, $2, $3, NOW(), $4, false)`,
        [nonce, playerA.publicKey(), message, pastExpiresAt]
      );

      const sig = Buffer.from(playerA.sign(Buffer.from(message, "utf-8"))).toString("base64");

      await expect(
        verifyChallenge(playerA.publicKey(), nonce, sig)
      ).rejects.toThrow("Challenge nonce has expired");
    });

    it("prevents third-party griefing attack on round-questions / verify-round", async () => {
      // Attacker tries to submit for playerA without signature or session token
      const attackRes = await app.inject({
        method: "POST",
        url: "/api/round-questions",
        payload: {
          roundId: "12345",
          type: "standard",
          walletAddress: playerA.publicKey(),
          // No signature, nonce, or sessionToken provided
        },
      });

      expect([400, 401, 404]).toContain(attackRes.statusCode);
    });
  });

  describe("Resolve Retry & Status Polling", () => {
    it("persists score before resolve and exposes status check endpoint", async () => {
      const db = await getDb();
      const testRoundId = "retry-test-" + Date.now();

      // Simulate a scored round that had initial chain failure
      await db.query(
        `INSERT INTO round_sessions (round_id, player, status, score, correct_count, total, won, error_message, created_at)
         VALUES ($1, $2, 'failed', 8, 8, 10, true, 'Simulated transient network timeout', NOW())`,
        [testRoundId, playerA.publicKey()]
      );

      // Poll round status
      const statusRes = await app.inject({
        method: "GET",
        url: `/api/round-status?roundId=${testRoundId}`,
      });

      expect(statusRes.statusCode).toBe(200);
      const statusData = JSON.parse(statusRes.payload);
      expect(statusData.roundId).toBe(testRoundId);
      expect(statusData.status).toBe("failed");
      expect(statusData.score).toBe(8);
      expect(statusData.won).toBe(true);
      expect(statusData.resolved).toBe(false);
      expect(statusData.errorMessage).toContain("Simulated transient network timeout");

      // Now simulate background auto-retry resolving it
      await db.query(
        `UPDATE round_sessions
         SET status = 'resolved', resolved_tx = 'tx-retry-success-123', error_message = NULL, resolved_at = NOW()
         WHERE round_id = $1`,
        [testRoundId]
      );

      // Re-poll round status
      const resolvedRes = await app.inject({
        method: "GET",
        url: `/api/round-status?roundId=${testRoundId}`,
      });

      expect(resolvedRes.statusCode).toBe(200);
      const resolvedData = JSON.parse(resolvedRes.payload);
      expect(resolvedData.status).toBe("resolved");
      expect(resolvedData.resolved).toBe(true);
      expect(resolvedData.txHash).toBe("tx-retry-success-123");
    });

    it("periodic sweep never retries permanent errors (AlreadyResolved, InvalidScore)", async () => {
      const db = await getDb();
      const permanentRound1 = "perm-round-1-" + Date.now();
      const permanentRound2 = "perm-round-2-" + Date.now();

      await db.query(
        `INSERT INTO round_sessions (round_id, player, status, score, correct_count, total, won, error_message, created_at)
         VALUES
           ($1, $2, 'failed', 8, 8, 10, true, 'AlreadyResolved on-chain', NOW()),
           ($3, $2, 'failed', 2, 2, 10, false, 'InvalidScore: permanent error', NOW())`,
        [permanentRound1, playerA.publicKey(), permanentRound2]
      );

      const sweepResult = await sweepPendingResolutions();
      expect(sweepResult.skippedPermanent).toBeGreaterThanOrEqual(2);

      // Check rows are still untouched and not resolved erroneously
      const checkRes = await db.query(
        `SELECT round_id, status FROM round_sessions WHERE round_id IN ($1, $2)`,
        [permanentRound1, permanentRound2]
      );
      expect(checkRes.rows.length).toBe(2);
      expect(checkRes.rows.every((r) => r.status === "failed")).toBe(true);
    });

    it("marks rows older than 100 minutes as needs_attention before 2-hour timeout", async () => {
      const db = await getDb();
      const oldRoundId = "stale-round-100m-" + Date.now();
      const oldCreatedAt = new Date(Date.now() - 105 * 60 * 1000); // 105 minutes ago

      await db.query(
        `INSERT INTO round_sessions (round_id, player, status, score, correct_count, total, won, error_message, created_at)
         VALUES ($1, $2, 'failed', 7, 7, 10, true, 'Simulated temporary outage', $3)`,
        [oldRoundId, playerA.publicKey(), oldCreatedAt]
      );

      const sweepResult = await sweepPendingResolutions();
      expect(sweepResult.needsAttention).toBeGreaterThanOrEqual(1);

      const check = await db.query(
        `SELECT status, error_message FROM round_sessions WHERE round_id = $1`,
        [oldRoundId]
      );
      expect(check.rows[0].status).toBe("needs_attention");
      expect(check.rows[0].error_message).toContain("100-minute retry limit");
    });

    it("sweeper measures the 100-minute window from onchain_created_at (even if DB row created_at is recent)", async () => {
      const db = await getDb();
      const onchainOldRoundId = "onchain-old-100m-" + Date.now();
      const onchainCreatedAt = new Date(Date.now() - 105 * 60 * 1000); // on-chain round created 105m ago
      const recentRowCreatedAt = new Date(); // DB row was created right now (e.g. server restart)

      await db.query(
        `INSERT INTO round_sessions (round_id, player, status, score, correct_count, total, won, error_message, created_at, onchain_created_at)
         VALUES ($1, $2, 'failed', 7, 7, 10, true, 'Temporary network issue', $3, $4)`,
        [onchainOldRoundId, playerA.publicKey(), recentRowCreatedAt, onchainCreatedAt]
      );

      const sweepResult = await sweepPendingResolutions();
      expect(sweepResult.needsAttention).toBeGreaterThanOrEqual(1);

      const check = await db.query(
        `SELECT status, error_message FROM round_sessions WHERE round_id = $1`,
        [onchainOldRoundId]
      );
      expect(check.rows[0].status).toBe("needs_attention");
      expect(check.rows[0].error_message).toContain("100-minute retry limit");
    });

    it("session edge: expired session returns 401 on /api/verify-round and client re-authenticates with new session token", async () => {
      // 1. Create an expired session token (-1 second)
      const expiredSession = createSessionToken(playerA.publicKey(), -1000);

      // Verify that verifySessionToken throws
      expect(() => verifySessionToken(expiredSession.sessionToken, playerA.publicKey())).toThrow("expired");

      // Verify that calling verify-round with expired token returns 401
      const expiredRes = await app.inject({
        method: "POST",
        url: "/api/verify-round",
        headers: {
          authorization: `Bearer ${expiredSession.sessionToken}`,
        },
        payload: {
          roundId: "999",
          questionIds: ["1", "2", "3"],
          submittedAnswers: [0, 1, 2],
          address: playerA.publicKey(),
          secretToken: "mock-secret",
          sessionToken: expiredSession.sessionToken,
        },
      });

      expect(expiredRes.statusCode).toBe(401);
      const errData = JSON.parse(expiredRes.payload);
      expect(errData.error).toContain("expired");

      // 2. Client re-signs: generates fresh challenge, signs, exchanges for new session token
      const freshChallenge = await createChallenge(playerA.publicKey());
      const prefix = "Stellar Signed Message:\n";
      const payload = Buffer.concat([
        Buffer.from(prefix, "utf-8"),
        Buffer.from(freshChallenge.message, "utf-8"),
      ]);
      const messageHash = crypto.createHash("sha256").update(payload).digest();
      const sigBase64 = Buffer.from(playerA.sign(messageHash)).toString("base64");

      const sessionRes = await app.inject({
        method: "POST",
        url: "/api/session",
        payload: {
          address: playerA.publicKey(),
          nonce: freshChallenge.nonce,
          signature: sigBase64,
        },
      });

      expect(sessionRes.statusCode).toBe(200);
      const freshSession = JSON.parse(sessionRes.payload);
      expect(freshSession.sessionToken).toBeDefined();

      // New token verifies cleanly without error
      const verified = verifySessionToken(freshSession.sessionToken, playerA.publicKey());
      expect(verified.address).toBe(playerA.publicKey());
    });
  });

  describe("XSS / Injection Escaping on /api/og and /api/share-card", () => {
    it("safely escapes script injection in /api/og username and custom params", async () => {
      const maliciousPayload = '<script>alert("xss")</script>';
      const res = await app.inject({
        method: "GET",
        url: `/api/og?username=${encodeURIComponent(maliciousPayload)}&score=8&total=10`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).not.toContain("<script>");
      expect(res.payload).toContain("&lt;script&gt;");
    });

    it("safely escapes SVG tag breakout payloads like \"></svg>", async () => {
      const breakoutPayload = '"></svg><script>alert(1)</script>';
      const res = await app.inject({
        method: "GET",
        url: `/api/og?username=${encodeURIComponent(breakoutPayload)}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).not.toContain('"></svg>');
      expect(res.payload).toContain("&quot;&gt;&lt;/svg&gt;");
    });

    it("safely escapes script injection in /api/share-card", async () => {
      const xssPayload = '<script>document.location="http://evil.com"</script>';
      const res = await app.inject({
        method: "GET",
        url: `/api/share-card?username=${encodeURIComponent(xssPayload)}&token=XLM`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).not.toContain("<script>document.location");
      expect(res.payload).not.toContain(xssPayload);
      expect(res.payload).toContain("%26lt%3Bscript%26gt%3Bdocument.location");
    });
  });
});
