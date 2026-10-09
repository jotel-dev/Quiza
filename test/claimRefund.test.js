import { describe, it, expect, beforeEach } from "vitest";

// Configure mock environment before importing quizaContract
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

const {
  claimRefund,
  retryWithdrawRefund,
  getRefundableRounds,
  recordStakedRound,
  setMockWithdrawShouldFail,
  setMockClaimTimeoutError,
  getMockPlayerBalance,
  setMockPlayerBalance,
  isAlreadyResolvedError,
} = await import("../src/lib/quizaContract.js");

describe("Claim Refund & Timeout Error Matching Suite", () => {
  const playerAddr = "GD3VW6CXVC2IEP23QWLHY6E2TLJCJI436FTLAYI3VC73YETPSW2ZQ3DY";

  beforeEach(() => {
    setMockWithdrawShouldFail(false);
    setMockClaimTimeoutError(null);
    setMockPlayerBalance(0n);
    globalThis.localStorage.clear();
  });

  // Test 1: Full Happy Path
  it("executes full happy path when claim_timeout and withdraw both succeed", async () => {
    recordStakedRound({
      roundId: "101",
      address: playerAddr,
      token: "XLM",
      amount: "0.01",
      timestamp: Date.now() - 8000 * 1000,
    });

    const res = await claimRefund("101");
    expect(res.claimTxHash).toBe("mock_claim_101");
    expect(res.withdrawTxHash).toBeDefined();
    expect(res.won).toBe(true);
    expect(getMockPlayerBalance()).toBe(0n);
  });

  // Test 2: Partial failure & retry withdraw
  it("handles withdraw failure gracefully and allows retryWithdrawRefund", async () => {
    recordStakedRound({
      roundId: "102",
      address: playerAddr,
      token: "XLM",
      amount: "0.01",
      timestamp: Date.now() - 8000 * 1000,
    });

    setMockWithdrawShouldFail(true);
    let caughtErr = null;
    try {
      await claimRefund("102");
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr).toBeDefined();
    expect(caughtErr.withdrawPending).toBe(true);
    expect(caughtErr.claimTxHash).toBe("mock_claim_102");
    expect(getMockPlayerBalance()).toBeGreaterThan(0n);

    // Reload detection
    const refundable = await getRefundableRounds(playerAddr);
    const pending = refundable.find((r) => r.roundId === "102");
    expect(pending).toBeDefined();
    expect(pending.withdrawPending).toBe(true);

    // Retry withdraw succeeds
    setMockWithdrawShouldFail(false);
    const retryTx = await retryWithdrawRefund("XLM");
    expect(retryTx).toBeDefined();
    expect(getMockPlayerBalance()).toBe(0n);
  });

  // Test 3: AlreadyResolved with positive balance (player won)
  it("skips claim and withdraws directly when claim_timeout fails with AlreadyResolved and balance > 0", async () => {
    recordStakedRound({
      roundId: "103",
      address: playerAddr,
      token: "XLM",
      amount: "0.01",
      timestamp: Date.now() - 8000 * 1000,
    });

    setMockClaimTimeoutError("HostError: Error(Contract, #8)");
    setMockPlayerBalance(100000n, "XLM");

    const res = await claimRefund("103");
    expect(res.claimTxHash).toBe("already_resolved");
    expect(res.withdrawTxHash).toBeDefined();
    expect(res.won).toBe(true);
    expect(res.alreadyResolved).toBe(true);
    expect(getMockPlayerBalance()).toBe(0n);
  });

  // Test 4: AlreadyResolved with zero balance (player lost)
  it("resolves cleanly without error when claim_timeout fails with AlreadyResolved and balance == 0", async () => {
    recordStakedRound({
      roundId: "104",
      address: playerAddr,
      token: "XLM",
      amount: "0.01",
      timestamp: Date.now() - 8000 * 1000,
    });

    setMockClaimTimeoutError("HostError: Error(Contract, #8)");
    setMockPlayerBalance(0n, "XLM");

    const res = await claimRefund("104");
    expect(res.claimTxHash).toBe("already_resolved");
    expect(res.withdrawTxHash).toBeNull();
    expect(res.won).toBe(false);
    expect(res.zeroBalance).toBe(true);
    expect(res.alreadyResolved).toBe(true);
  });

  // Test 5: Error matching exact Soroban format vs look-alikes
  it("matches exact Soroban AlreadyResolved #8 and rejects look-alikes", () => {
    // Valid matches
    expect(isAlreadyResolvedError("Error(Contract, #8)")).toBe(true);
    expect(isAlreadyResolvedError("HostError: Error(Contract, #8)")).toBe(true);
    expect(isAlreadyResolvedError("Simulation failed: HostError: Error(Contract, #8)")).toBe(true);
    expect(isAlreadyResolvedError(new Error("HostError: Error(Contract, #8)"))).toBe(true);
    expect(isAlreadyResolvedError("AlreadyResolved")).toBe(true);
    expect(isAlreadyResolvedError(new Error("AlreadyResolved: round is already resolved"))).toBe(true);
    expect(isAlreadyResolvedError("This round has already been resolved or refunded.")).toBe(true);

    // Look-alikes that MUST NOT match
    expect(isAlreadyResolvedError("error 80")).toBe(false);
    expect(isAlreadyResolvedError("Error(Contract, #18)")).toBe(false);
    expect(isAlreadyResolvedError("Error(Contract, #80)")).toBe(false);
    expect(isAlreadyResolvedError("Error(Contract, #81)")).toBe(false);
    expect(isAlreadyResolvedError("Error(Contract, #88)")).toBe(false);
    expect(isAlreadyResolvedError("Random failure 8")).toBe(false);
    expect(isAlreadyResolvedError("HostError: Error(Contract, #9)")).toBe(false);
  });
});
