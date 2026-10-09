import {
  Horizon,
  rpc,
  TransactionBuilder,
  Networks,
  Asset,
  Operation,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";

export const STROOP_SCALE = 10_000_000n; // 7 decimals

/**
 * Parses a decimal string (e.g. "0.01", "10", "1.5") to BigInt stroops (7 decimals).
 * Never uses IEEE-754 floating point arithmetic.
 */
export function parseStroops(amountStr) {
  if (typeof amountStr === "bigint") return amountStr;
  if (typeof amountStr === "number") amountStr = amountStr.toString();
  if (!amountStr || typeof amountStr !== "string") return 0n;

  const trimmed = amountStr.trim();
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const cleanWhole = whole.replace(/^0+/, "") || "0";
  const paddedFraction = fraction.padEnd(7, "0").slice(0, 7);
  return BigInt(cleanWhole) * STROOP_SCALE + BigInt(paddedFraction);
}

/**
 * Formats BigInt stroops (7 decimals) to a decimal string with fixed precision.
 */
export function formatStroops(stroops, decimals = 4) {
  const b = typeof stroops === "bigint" ? stroops : BigInt(stroops || 0);
  const whole = b / STROOP_SCALE;
  const fraction = (b % STROOP_SCALE).toString().padStart(7, "0");
  const truncatedFraction = fraction.slice(0, decimals);
  return `${whole}.${truncatedFraction}`;
}

export function getRpcServer(rpcUrl) {
  return new rpc.Server(rpcUrl, { allowHttp: false });
}

export function getHorizonServer(horizonUrl) {
  return new Horizon.Server(horizonUrl);
}

/**
 * Maps Soroban contract error codes to human-readable error messages.
 */
export function mapContractError(err) {
  const msg = err?.message || err?.toString() || "Transaction failed";
  const msgLower = msg.toLowerCase();

  if (msgLower.includes("user declined") || msgLower.includes("user rejected") || msgLower.includes("4001")) {
    return "Transaction was rejected in your wallet. Please try again.";
  }
  if (msgLower.includes("paused") || msg.includes("Error(Contract, #3)")) {
    return "Staking is currently paused by the administrator.";
  }
  if (msgLower.includes("alreadyresolved") || msg.includes("Error(Contract, #8)")) {
    return "This round has already been resolved or refunded.";
  }
  if (msgLower.includes("timeoutnotreached") || msg.includes("Error(Contract, #9)")) {
    return "The 2-hour timeout refund window has not elapsed yet.";
  }
  if (msgLower.includes("zerobalance") || msg.includes("Error(Contract, #10)")) {
    return "No withdrawable balance available for this token.";
  }
  if (msgLower.includes("insufficientpoolliquidity") || msg.includes("Error(Contract, #11)")) {
    return "The game pool currently has insufficient liquidity to cover this payout.";
  }
  if (msgLower.includes("tokennotallowed") || msg.includes("Error(Contract, #12)")) {
    return "This token is not supported for staking.";
  }
  if (msgLower.includes("scoreresultmismatch") || msg.includes("Error(Contract, #13)")) {
    return "Trivia score does not match the round outcome.";
  }
  if (msgLower.includes("stakeexceedslimit") || msg.includes("Error(Contract, #14)")) {
    return "Stake exceeds the maximum allowed limit.";
  }
  if (msgLower.includes("stakebelowlimit") || msg.includes("Error(Contract, #15)")) {
    return "Stake is below the minimum required limit.";
  }
  if (msgLower.includes("op_underfunded") || msgLower.includes("insufficient balance") || msgLower.includes("fee")) {
    return "Transaction failed. Please ensure you have enough XLM to cover the network fee.";
  }
  return msg;
}
