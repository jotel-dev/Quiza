import {
  rpc,
  Contract,
  scValToNative,
  nativeToScVal,
  Account,
  TransactionBuilder,
  Horizon,
  Keypair,
} from "@stellar/stellar-sdk";
import { config } from "../config.js";

export const rpcServer = new rpc.Server(config.SOROBAN_RPC_URL);
export const horizonServer = new Horizon.Server(config.HORIZON_URL);
export const contract = new Contract(config.QUIZA_CONTRACT_ID);

export interface OnChainRound {
  player: string;
  token: string;
  amount: bigint;
  resolved: boolean;
  won: boolean;
  score: number;
  createdAt: number;
}

export interface PoolAccounting {
  pool: bigint;
  locked: bigint;
  owed: bigint;
}

const dummyAccount = new Account("GCMKX5CZ4UCWKKUMGQ3WDEJ4AFCNCCJW5R54IWZH7BE6RK6H2KG45QCU", "0");

export async function getRound(roundId: number | string | bigint): Promise<OnChainRound | null> {
  const numericId = BigInt(roundId);
  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_round", nativeToScVal(numericId, { type: "u64" })))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    // If error is RoundNotFound or revert
    return null;
  }

  if (!sim.result || !sim.result.retval) {
    return null;
  }

  const native = scValToNative(sim.result.retval);
  if (!native || !native.player) {
    return null;
  }

  return {
    player: native.player,
    token: native.token,
    amount: BigInt(native.amount ?? 0),
    resolved: Boolean(native.resolved),
    won: Boolean(native.won),
    score: Number(native.score ?? 0),
    createdAt: Number(native.created_at ?? 0),
  };
}

export async function getAccounting(tokenAddress: string): Promise<PoolAccounting> {
  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("get_accounting", nativeToScVal(tokenAddress, { type: "address" }))
    )
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result || !sim.result.retval) {
    return { pool: 0n, locked: 0n, owed: 0n };
  }

  const native = scValToNative(sim.result.retval);
  return {
    pool: BigInt(native.pool ?? 0),
    locked: BigInt(native.locked ?? 0),
    owed: BigInt(native.owed ?? 0),
  };
}

export async function getVerifierBalance(publicKey: string): Promise<string> {
  try {
    const acc = await horizonServer.loadAccount(publicKey);
    const nativeBal = acc.balances.find((b) => b.asset_type === "native");
    return nativeBal ? nativeBal.balance : "0";
  } catch (err) {
    return "0";
  }
}

export async function checkRpcHealth(): Promise<boolean> {
  try {
    const health = await rpcServer.getHealth();
    return health.status === "healthy";
  } catch (err) {
    try {
      const ledger = await rpcServer.getLatestLedger();
      return Boolean(ledger && ledger.sequence > 0);
    } catch {
      return false;
    }
  }
}
