import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.VITE_USE_CONTRACT_MOCK = "true";

globalThis.window = globalThis;
const storage = {};
globalThis.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => {
    storage[key] = String(val);
  },
  removeItem: (key) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  },
};

const { submitRoundForVerification } = await import("../src/lib/quizaContract.js");

describe("Submit Round Verification Timeout Recovery Suite", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("recovers and returns complete Results shape when POST times out and polling resolves", async () => {
    const roundId = "test-recovery-101";
    const playerAddr = "GD3VW6CXVC2IEP23QWLHY6E2TLJCJI436FTLAYI3VC73YETPSW2ZQ3DY";
    const expectedAnswers = ["A", "B", "C", "D", "E"];

    // Mock global fetch:
    // Call 1: POST /api/verify-round times out with TimeoutError
    // Call 2: GET /api/round-status returns scored/resolved round data
    const originalFetch = globalThis.fetch;
    let postAttempted = false;

    globalThis.fetch = vi.fn(async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/verify-round")) {
        postAttempted = true;
        // Simulate AbortController timeout error
        const abortErr = new Error("The operation was aborted due to timeout");
        abortErr.name = "AbortError";
        throw abortErr;
      }

      if (urlStr.includes("/api/round-status")) {
        expect(urlStr).not.toContain("address=");
        const authHeader = options?.headers?.Authorization || options?.headers?.authorization;
        expect(authHeader).toBe("Bearer mock-session-token");
        return {
          ok: true,
          status: 200,
          clone: () => ({ json: async () => ({}) }),
          json: async () => ({
            roundId,
            status: "resolved",
            score: 5,
            correctCount: 5,
            total: 5,
            won: true,
            txHash: "mock_tx_polling_recovery_456",
            correctAnswers: expectedAnswers,
          }),
        };
      }

      return originalFetch ? originalFetch(url, options) : { ok: true, json: async () => ({}) };
    });

    try {
      const result = await submitRoundForVerification({
        roundId,
        questionIds: ["q1", "q2", "q3", "q4", "q5"],
        submittedAnswers: ["A", "B", "C", "D", "E"],
        address: playerAddr,
        secretToken: "secret_123",
      });

      expect(postAttempted).toBe(true);
      expect(result.won).toBe(true);
      expect(result.correctCount).toBe(5);
      expect(result.total).toBe(5);
      expect(result.txHash).toBe("mock_tx_polling_recovery_456");
      expect(result.correctAnswers).toEqual(expectedAnswers);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
