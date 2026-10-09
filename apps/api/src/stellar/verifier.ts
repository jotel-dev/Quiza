import {
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  Operation,
} from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { rpcServer, contract, getRound } from "./client.js";
import { verifierQueue } from "./queue.js";

export class AlreadyResolvedError extends Error {
  constructor(message = "Round is already resolved on-chain") {
    super(message);
    this.name = "AlreadyResolvedError";
  }
}

export class InsufficientPoolLiquidityError extends Error {
  constructor(message = "Insufficient pool liquidity to payout winnings") {
    super(message);
    this.name = "InsufficientPoolLiquidityError";
  }
}

export class InvalidScoreError extends Error {
  constructor(message = "Invalid score submitted for round") {
    super(message);
    this.name = "InvalidScoreError";
  }
}

function parseContractError(errorStr: string): Error {
  if (errorStr.includes("AlreadyResolved") || errorStr.includes("#8") || errorStr.includes("error 8")) {
    return new AlreadyResolvedError();
  }
  if (errorStr.includes("InvalidScore") || errorStr.includes("#5") || errorStr.includes("error 5")) {
    return new InvalidScoreError();
  }
  if (
    errorStr.includes("InsufficientPoolLiquidity") ||
    errorStr.includes("#11") ||
    errorStr.includes("error 11")
  ) {
    return new InsufficientPoolLiquidityError();
  }
  return new Error(errorStr);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeResolveOnChain(
  roundId: string | number | bigint,
  won: boolean,
  score: number
): Promise<string> {
  const numericRoundId = BigInt(roundId);
  const keypair = Keypair.fromSecret(config.QUIZA_VERIFIER_SECRET_KEY);
  const verifierPublicKey = keypair.publicKey();

  // 1. Verify round status first
  const existingRound = await getRound(numericRoundId);
  if (!existingRound) {
    throw new Error(`Round ${roundId} does not exist on-chain`);
  }
  if (existingRound.resolved) {
    throw new AlreadyResolvedError(`Round ${roundId} is already marked resolved on-chain`);
  }

  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      // Refresh account sequence
      const account = await rpcServer.getAccount(verifierPublicKey);

      const tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "resolve",
            nativeToScVal(numericRoundId, { type: "u64" }),
            nativeToScVal(won, { type: "bool" }),
            nativeToScVal(score, { type: "u32" })
          )
        )
        .setTimeout(60)
        .build();

      const sim = await rpcServer.simulateTransaction(tx);

      if (rpc.Api.isSimulationError(sim)) {
        const errDetail = sim.error || JSON.stringify(sim);
        throw parseContractError(errDetail);
      }

      // Check if restoration footprint is required
      if (rpc.Api.isSimulationRestore(sim)) {
        const restoreTx = new TransactionBuilder(account, {
          fee: "100000",
          networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
        })
          .addOperation(Operation.restoreFootprint({}))
          .setTimeout(60)
          .build();
        const restoreSim = await rpcServer.simulateTransaction(restoreTx);
        const assembledRestore = rpc.assembleTransaction(restoreTx, restoreSim).build();
        assembledRestore.sign(keypair);
        await rpcServer.sendTransaction(assembledRestore);
        await sleep(1500);
      }

      const prepared = rpc.assembleTransaction(tx, sim).build();
      prepared.sign(keypair);

      const sendRes = await rpcServer.sendTransaction(prepared);

      if (sendRes.status === "ERROR") {
        const errorMsg =
          (sendRes as any).errorResultXdr ||
          JSON.stringify((sendRes as any).errorResult || {}) ||
          "RPC submission error";
        if (errorMsg.includes("tx_bad_seq") || errorMsg.includes("tx_internal_error")) {
          retries--;
          await sleep(delay);
          delay *= 2;
          continue;
        }
        throw parseContractError(errorMsg);
      }

      const txHash = sendRes.hash;

      // Poll for confirmation
      let attempts = 30;
      while (attempts > 0) {
        await sleep(1000);
        const status = await rpcServer.getTransaction(txHash);
        if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          return txHash;
        } else if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
          const detail = status.resultXdr?.toString() || "Transaction execution failed";
          throw parseContractError(detail);
        }
        attempts--;
      }

      // If poll timed out but was sent, return the hash
      return txHash;
    } catch (err: any) {
      if (err instanceof AlreadyResolvedError || err instanceof InsufficientPoolLiquidityError) {
        throw err;
      }
      const msg = err?.message || String(err);
      if (msg.includes("tx_bad_seq") || msg.includes("fetch failed") || msg.includes("504")) {
        retries--;
        if (retries > 0) {
          await sleep(delay);
          delay *= 2;
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error(`Failed to resolve round ${roundId} after multiple attempts`);
}

/**
 * Serialized entrypoint: every verifier transaction is placed in a single serial queue
 * to ensure that concurrent transactions never experience `tx_bad_seq` sequence number collisions.
 */
export async function resolveRoundOnChain(
  roundId: string | number | bigint,
  won: boolean,
  score: number
): Promise<string> {
  return verifierQueue.enqueue(() => executeResolveOnChain(roundId, won, score));
}
