import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

describe("API Routes & Negative Cases Integration Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns status ok with DB, RPC, verifier balance, and pool info", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("quiza-api");
    expect(body.db).toBe(true);
    expect(body.rpc).toBe(true);
    expect(typeof body.verifierAddress).toBe("string");
    expect(body.verifierAddress.startsWith("G")).toBe(true);
    expect(typeof body.verifierBalance).toBe("string");
    expect(body.pool).toBeDefined();
    expect(body.pool.XLM).toBeDefined();
    // Ensure no secrets are present
    expect(JSON.stringify(body)).not.toContain("SDX");
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  it("POST /api/user updates player username with valid Stellar address", async () => {
    const testAddress = "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT";
    const res = await app.inject({
      method: "POST",
      url: "/api/user",
      payload: {
        address: testAddress,
        username: "StarGazer",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ success: true });

    // Verify in leaderboard
    const lbRes = await app.inject({
      method: "GET",
      url: "/api/leaderboard",
    });
    expect(lbRes.statusCode).toBe(200);
    const lbBody = JSON.parse(lbRes.payload);
    expect(Array.isArray(lbBody.players)).toBe(true);
    const player = lbBody.players.find((p: any) => p.address === testAddress);
    expect(player).toBeDefined();
    expect(player.username).toBe("StarGazer");
  });

  it("POST /api/user rejects invalid or old 0x addresses", async () => {
    const badAddress = "0x22baf440fF5eFB18015413D2Bb4FDFC8b63a6484";
    const res = await app.inject({
      method: "POST",
      url: "/api/user",
      payload: {
        address: badAddress,
        username: "OldPlayer",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain("Invalid Stellar wallet address");
  });

  it("GET /api/question-stats returns categories and difficulty counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/question-stats",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total).toBeGreaterThan(50);
    expect(body.categories).toBeDefined();
    expect(body.categories.Web3).toBeDefined();
    expect(body.categories.Math).toBeDefined();
  });

  it("GET /api/og returns SVG image containing 'BUILT ON STELLAR' and 'Freighter'", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/og?score=9&total=10&multiplier=1.5x&won=true",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.payload).toContain("BUILT ON STELLAR");
    expect(res.payload).toContain("Freighter");
    expect(res.payload).not.toContain("BUILT ON CELO");
    expect(res.payload).not.toContain("MiniPay");
  });

  it("GET /api/share-card returns HTML card with Stellar metadata", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/share-card?score=10&total=10&won=true",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.payload).toContain("Stellar");
    expect(res.payload).not.toContain("Celo");
  });

  it("POST /api/verify-practice scores correctly without chain interaction", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/verify-practice",
      payload: {
        roundId: "practice-test-1",
        questionIds: ["m001", "m002"],
        submittedAnswers: [1, 2], // m001: 1 (96), m002: 2 (12) -> both correct
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total).toBe(2);
    expect(body.correctCount).toBe(2);
    expect(body.won).toBe(true);
    expect(body.txHash).toBeNull();
    expect(body.correctAnswers).toEqual([1, 2]);
  });

  it("POST /api/round-questions returns questions and secretToken for practice mode", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/round-questions",
      payload: {
        roundId: "practice-round-99",
        type: "practice",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions.length).toBe(5);
    expect(typeof body.secretToken).toBe("string");
    // Answers must not be present
    body.questions.forEach((q: any) => {
      expect(q.answer).toBeUndefined();
    });
  });

  it("POST /api/round-questions rejects standard rounds if round does not exist on-chain", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/round-questions",
      payload: {
        roundId: 999999999, // non-existent round
        type: "standard",
        walletAddress: "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT",
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain("does not exist on-chain");
  });

  it("POST /api/verify-round rejects requests with old 0x or invalid address", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/verify-round",
      payload: {
        roundId: "1",
        questionIds: ["m001"],
        submittedAnswers: [1],
        address: "0x1234567890123456789012345678901234567890",
        secretToken: "invalid-token",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain("Missing or invalid player address");
  });

  it("POST /api/verify-round rejects requests with invalid or forged session token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/verify-round",
      payload: {
        roundId: "1",
        questionIds: ["m001"],
        submittedAnswers: [1],
        address: "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT",
        secretToken: "fake-uuid.forged-hmac-signature",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain("Invalid or expired round session token");
  });
});
