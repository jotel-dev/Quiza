import freighterApi from "@stellar/freighter-api";
import {
  Horizon,
  rpc,
  TransactionBuilder,
  Networks,
  Asset,
  Operation,
  Contract,
  Address,
  Account,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";

import {
  parseStroops,
  formatStroops,
  mapContractError,
} from "./stellar.js";
import { apiFetch } from "./api.js";

// --- Network & Configuration ----------------------------------------------
const getEnv = (key, fallback) => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

export function isMockMode() {
  return getEnv("VITE_USE_CONTRACT_MOCK", "false") === "true";
}
export const IS_MOCK_MODE = isMockMode();

export const NETWORK = getEnv("VITE_STELLAR_NETWORK", "testnet");

export const STELLAR_NETWORKS = {
  testnet: {
    network: "testnet",
    networkPassphrase: getEnv("VITE_STELLAR_NETWORK_PASSPHRASE", Networks.TESTNET),
    horizonUrl: getEnv("VITE_HORIZON_URL", "https://horizon-testnet.stellar.org"),
    rpcUrl: getEnv("VITE_SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org"),
    explorerUrl: "https://stellar.expert/explorer/testnet",
    contractId: getEnv(
      "VITE_QUIZA_CONTRACT_ID",
      "CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV"
    ),
    xlmContractId: getEnv(
      "VITE_XLM_CONTRACT_ID",
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    ),
    usdcContractId: getEnv(
      "VITE_USDC_CONTRACT_ID",
      "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
    ),
    usdcIssuer: getEnv(
      "VITE_USDC_ISSUER",
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    ),
  },
  public: {
    network: "public",
    networkPassphrase: Networks.PUBLIC,
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: "https://mainnet.sorobanrpc.com",
    explorerUrl: "https://stellar.expert/explorer/public",
    contractId: getEnv("VITE_QUIZA_CONTRACT_ID", ""),
    xlmContractId: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    usdcContractId: "CCW67TSZV3SSS2HXMBQ5KGHSKJIS2DUXMHBHTMSO7QYCHWFAE4TG4E3O",
    usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  },
};

// Aliases for backward compatibility with existing code
export const CELO_NETWORKS = {
  alfajores: STELLAR_NETWORKS.testnet,
  mainnet: STELLAR_NETWORKS.testnet,
  testnet: STELLAR_NETWORKS.testnet,
};

export const QUIZA_CONTRACT_ADDRESS = {
  alfajores: STELLAR_NETWORKS.testnet.contractId,
  mainnet: STELLAR_NETWORKS.testnet.contractId,
  testnet: STELLAR_NETWORKS.testnet.contractId,
};

export const CELO_NATIVE_ADDRESS = STELLAR_NETWORKS.testnet.xlmContractId;
export const XLM_CONTRACT_ID = STELLAR_NETWORKS.testnet.xlmContractId;

export const CUSD_ADDRESS = {
  alfajores: STELLAR_NETWORKS.testnet.usdcContractId,
  mainnet: STELLAR_NETWORKS.testnet.usdcContractId,
  testnet: STELLAR_NETWORKS.testnet.usdcContractId,
};
export const USDC_CONTRACT_ID = STELLAR_NETWORKS.testnet.usdcContractId;

export const QUIZA_ABI = []; // Kept for interface compatibility

export { parseStroops, formatStroops };

// --- Server Helpers -------------------------------------------------------
function getNetworkConfig(net = NETWORK) {
  return STELLAR_NETWORKS[net] || STELLAR_NETWORKS.testnet;
}

function getRpc(net = NETWORK) {
  const cfg = getNetworkConfig(net);
  return new rpc.Server(cfg.rpcUrl);
}

function getHorizon(net = NETWORK) {
  const cfg = getNetworkConfig(net);
  return new Horizon.Server(cfg.horizonUrl);
}

// --- Mock State (for offline / mock testing) ------------------------------
let mockRoundCounter = 100;
let mockPlayerBalances = new Map();
let mockWithdrawShouldFail = false;
let mockClaimTimeoutError = null;
const MOCK_ADDRESS = "GD3VW6CXVC2IEP23QWLHY6E2TLJCJI436FTLAYI3VC73YETPSW2ZQ3DY";

export function setMockWithdrawShouldFail(shouldFail) {
  mockWithdrawShouldFail = Boolean(shouldFail);
}

export function setMockClaimTimeoutError(err) {
  mockClaimTimeoutError = err;
}

export function setMockPlayerBalance(bal, tokenSymbol = "XLM") {
  mockPlayerBalances.set(tokenSymbol, BigInt(bal));
}

export function getMockPlayerBalance(tokenSymbol = "XLM") {
  return mockPlayerBalances.get(tokenSymbol) || 0n;
}

export async function getConnectedAddress() {
  if (IS_MOCK_MODE) return MOCK_ADDRESS;
  try {
    if (typeof window === "undefined" || !freighterApi?.getAddress) return null;
    const res = await freighterApi.getAddress();
    return res?.address || res || null;
  } catch {
    return null;
  }
}

// --- Wallet Connection ----------------------------------------------------

/**
 * Connects to the Freighter wallet.
 * Returns { provider, signer, address, isMiniPay, isFreighter }.
 */
export async function connectWallet(silent = false) {
  if (IS_MOCK_MODE) {
    console.log("[CONTRACT MOCK] connectWallet called");
    return {
      provider: getRpc(),
      signer: { address: MOCK_ADDRESS },
      address: MOCK_ADDRESS,
      isMiniPay: false,
      isFreighter: true,
    };
  }

  try {
    const isConnectedRes = await freighterApi.isConnected();
    const isConn = isConnectedRes?.isConnected ?? isConnectedRes;
    if (!isConn) {
      if (silent) return { provider: null, signer: null, address: null, isMiniPay: false, isFreighter: false };
      throw new Error("Freighter wallet extension not found. Please install Freighter from freighter.app.");
    }

    const accessRes = await freighterApi.requestAccess();
    if (accessRes?.error) {
      if (silent) return { provider: null, signer: null, address: null, isMiniPay: false, isFreighter: false };
      throw new Error(accessRes.error);
    }

    const addrRes = accessRes?.address ? accessRes : await freighterApi.getAddress();
    const address = addrRes?.address || addrRes;
    if (!address) {
      if (silent) return { provider: null, signer: null, address: null, isMiniPay: false, isFreighter: false };
      throw new Error("No address returned from Freighter wallet.");
    }

    const provider = getRpc();
    const signer = {
      address,
      getAddress: async () => address,
    };

    return {
      provider,
      signer,
      address,
      isMiniPay: false,
      isFreighter: true,
    };
  } catch (err) {
    if (silent) return { provider: null, signer: null, address: null, isMiniPay: false, isFreighter: false };
    throw new Error(mapContractError(err));
  }
}

/**
 * Ensures Freighter is configured on the expected Stellar network.
 */
export async function ensureNetwork(network = NETWORK) {
  if (IS_MOCK_MODE) {
    console.log("[CONTRACT MOCK] ensureNetwork validated for:", network);
    return;
  }

  const expected = getNetworkConfig(network);
  try {
    const details = await freighterApi.getNetworkDetails();
    if (details?.networkPassphrase && details.networkPassphrase !== expected.networkPassphrase) {
      throw new Error(
        `Freighter network mismatch. Freighter is currently on "${details.network || "unknown"}". Please switch Freighter to Testnet in wallet settings.`
      );
    }
  } catch (e) {
    if (e.message.includes("mismatch")) throw e;
    console.warn("Could not query Freighter network details directly:", e?.message);
  }
}

/**
 * Returns wallet balances for an address.
 * Return shape: { XLM, USDC, CELO, cUSD } (4-decimal strings for UI parity).
 */
export async function getWalletBalances(provider, address, network = NETWORK) {
  if (IS_MOCK_MODE) {
    console.log("[CONTRACT MOCK] getWalletBalances called for:", address);
    return {
      XLM: "100.0000",
      USDC: "50.0000",
      CELO: "100.0000",
      cUSD: "50.0000",
    };
  }

  const horizon = getHorizon(network);

  let xlmBal = "0.0000";
  let usdcBal = "0.0000";

  try {
    const account = await horizon.loadAccount(address);
    for (const b of account.balances) {
      if (b.asset_type === "native") {
        xlmBal = parseFloat(b.balance || "0").toFixed(4);
      } else if (b.asset_code === "USDC") {
        usdcBal = parseFloat(b.balance || "0").toFixed(4);
      }
    }
  } catch (e) {
    // Account might be unfunded on testnet
    console.warn("Could not load account balances from Horizon (unfunded?):", e?.message);
  }

  return {
    XLM: xlmBal,
    USDC: usdcBal,
    CELO: xlmBal, // Alias for backward compatibility
    cUSD: usdcBal, // Alias for backward compatibility
  };
}

// --- Trustline Check & Setup ----------------------------------------------
async function ensureUsdcTrustline(playerAddress, network = NETWORK) {
  if (IS_MOCK_MODE) return;
  const cfg = getNetworkConfig(network);
  const horizon = getHorizon(network);
  const account = await horizon.loadAccount(playerAddress);

  const hasTrustline = account.balances.some(
    (b) => b.asset_code === "USDC" && b.asset_issuer === cfg.usdcIssuer
  );
  if (hasTrustline) return;

  console.log("Setting up USDC trustline for account:", playerAddress);
  const trustOp = Operation.changeTrust({
    asset: new Asset("USDC", cfg.usdcIssuer),
  });

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(trustOp)
    .setTimeout(30)
    .build();

  const signRes = await freighterApi.signTransaction(tx.toXDR(), {
    networkPassphrase: cfg.networkPassphrase,
    address: playerAddress,
  });

  const signedXdr = signRes?.signedTxXdr || signRes?.signedTransaction || signRes;
  const signedTx = TransactionBuilder.fromXDR(signedXdr, cfg.networkPassphrase);
  await horizon.submitTransaction(signedTx);
  console.log("USDC trustline established successfully.");
}

// --- Core Soroban Invocation Pipeline -------------------------------------

/**
 * Polls getTransaction until success or failure.
 */
async function pollTransaction(rpcServer, hash, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await rpcServer.getTransaction(hash);
    if (res.status === "SUCCESS") {
      return res;
    }
    if (res.status === "FAILED") {
      throw new Error(`Transaction ${hash} failed on-chain.`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Transaction ${hash} wait timed out.`);
}

/**
 * Prepares, restores (if needed), signs with Freighter, and submits a Soroban call.
 */
async function invokeSorobanMethod({
  method,
  args,
  playerAddress,
  network = NETWORK,
}) {
  const cfg = getNetworkConfig(network);
  const rpcServer = getRpc(network);
  const contract = new Contract(cfg.contractId);

  // 1. Fetch account
  let account = await rpcServer.getAccount(playerAddress);

  // 2. Build preliminary transaction
  let tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // 3. Simulate
  let sim = await rpcServer.simulateTransaction(tx);
  if (sim?.error) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  // 4. Handle archived state restoration if needed
  if (sim.restorePreamble && sim.restorePreamble.transactionData) {
    console.log("State restoration required. Executing restoreFootprint first...");
    const restoreTx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(Operation.restoreFootprint({}))
      .setSorobanData(sim.restorePreamble.transactionData)
      .setTimeout(30)
      .build();

    const signedRestore = await freighterApi.signTransaction(restoreTx.toXDR(), {
      networkPassphrase: cfg.networkPassphrase,
      address: playerAddress,
    });
    const restoreXdr = signedRestore?.signedTxXdr || signedRestore?.signedTransaction || signedRestore;
    const sentRestore = await rpcServer.sendTransaction(
      TransactionBuilder.fromXDR(restoreXdr, cfg.networkPassphrase)
    );
    await pollTransaction(rpcServer, sentRestore.hash);

    // Reload account and re-simulate
    account = await rpcServer.getAccount(playerAddress);
    tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(60)
      .build();
    sim = await rpcServer.simulateTransaction(tx);
  }

  // 5. Assemble transaction with simulated footprint and auth
  const preparedTx = rpc.assembleTransaction(tx, sim).build();

  // 6. Sign with Freighter
  const signRes = await freighterApi.signTransaction(preparedTx.toXDR(), {
    networkPassphrase: cfg.networkPassphrase,
    address: playerAddress,
  });
  if (signRes?.error) {
    throw new Error(signRes.error);
  }
  const signedXdr = signRes?.signedTxXdr || signRes?.signedTransaction || signRes;

  // 7. Submit to Soroban RPC
  const signedTx = TransactionBuilder.fromXDR(signedXdr, cfg.networkPassphrase);
  const sendRes = await rpcServer.sendTransaction(signedTx);
  if (sendRes.status === "ERROR") {
    throw new Error(`Transaction submission error: ${JSON.stringify(sendRes.errorResult)}`);
  }

  // 8. Poll for confirmation
  const finalRes = await pollTransaction(rpcServer, sendRes.hash);
  const returnValue = finalRes.returnValue ? scValToNative(finalRes.returnValue) : null;

  return {
    hash: sendRes.hash,
    transactionHash: sendRes.hash,
    returnValue,
    logs: [],
  };
}

// --- Staking --------------------------------------------------------------

/**
 * Universal staking function for XLM or USDC.
 */
export async function stakeRound({
  signer,
  tokenSymbol = "XLM",
  amount = "0.01",
  network = NETWORK,
}) {
  const isXlm = tokenSymbol === "XLM" || tokenSymbol === "CELO";
  const cfg = getNetworkConfig(network);
  const tokenAddress = isXlm ? cfg.xlmContractId : cfg.usdcContractId;

  if (IS_MOCK_MODE) {
    mockRoundCounter += 1;
    console.log(`[CONTRACT MOCK] stakeRound: token=${tokenSymbol}, amount=${amount}, roundId=${mockRoundCounter}`);
    return {
      roundId: mockRoundCounter,
      hash: `mock_tx_${Date.now()}`,
      transactionHash: `mock_tx_${Date.now()}`,
      logs: [],
    };
  }

  try {
    const playerAddress = typeof signer === "string" ? signer : await signer.getAddress();

    // 1. Obtain the session signature BEFORE the Soroban stake transaction,
    // so declining the message popup never leaves a stake locked on-chain.
    // If a valid session already exists in memory, this is a no-op with 0 popups.
    await getOrCreateAuthSessionToken(playerAddress, network);

    if (!isXlm) {
      await ensureUsdcTrustline(playerAddress, network);
    }

    const amountInStroops = parseStroops(amount);

    const res = await invokeSorobanMethod({
      method: "stake",
      args: [
        new Address(playerAddress).toScVal(),
        new Address(tokenAddress).toScVal(),
        nativeToScVal(amountInStroops, { type: "i128" }),
      ],
      playerAddress,
      network,
    });

    const roundId = res.returnValue ? Number(res.returnValue) : null;
    if (roundId) {
      recordStakedRound({
        roundId,
        address: playerAddress,
        token: tokenSymbol,
        amount,
        network,
        timestamp: Date.now(),
      });
    }
    return {
      ...res,
      roundId,
    };
  } catch (err) {
    console.error("Staking failed:", err);
    throw new Error(mapContractError(err));
  }
}

/** Wrapper for backward compatibility with StakeModal / UI */
export async function stakeCelo(signer, amountInCelo = "0.01", network = NETWORK) {
  return stakeRound({ signer, tokenSymbol: "XLM", amount: amountInCelo, network });
}

/** Wrapper for backward compatibility with StakeModal / UI */
export async function stakeCUSD(signer, amountInCUSD = "0.01", network = NETWORK) {
  return stakeRound({ signer, tokenSymbol: "USDC", amount: amountInCUSD, network });
}

/** Extracts the roundId from a stake receipt */
export function getRoundIdFromReceipt(receipt, network = NETWORK) {
  if (!receipt) return null;
  return receipt.roundId || receipt.returnValue || null;
}

// --- Payout & Withdrawal --------------------------------------------------

/**
 * Withdraws accumulated player winnings for a token.
 */
export async function withdrawWinnings(signer, tokenAddress, network = NETWORK) {
  const cfg = getNetworkConfig(network);
  const targetToken = tokenAddress || cfg.xlmContractId;

  if (IS_MOCK_MODE || isMockMode()) {
    console.log("[CONTRACT MOCK] withdrawWinnings called for token:", targetToken);
    if (mockWithdrawShouldFail) {
      throw new Error("Withdrawal transaction rejected by player");
    }
    const sym = targetToken === cfg.usdcContractId ? "USDC" : "XLM";
    mockPlayerBalances.set(sym, 0n);
    return {
      hash: `mock_withdraw_${Date.now()}`,
      transactionHash: `mock_withdraw_${Date.now()}`,
    };
  }

  try {
    const playerAddress = typeof signer === "string" ? signer : await signer.getAddress();

    // If withdrawing USDC, ensure trustline exists so receipt doesn't fail
    if (targetToken === cfg.usdcContractId) {
      await ensureUsdcTrustline(playerAddress, network);
    }

    const res = await invokeSorobanMethod({
      method: "withdraw",
      args: [
        new Address(playerAddress).toScVal(),
        new Address(targetToken).toScVal(),
      ],
      playerAddress,
      network,
    });

    return res;
  } catch (err) {
    console.error("Withdrawal error:", err);
    throw new Error(mapContractError(err));
  }
}

/**
 * Claims a refund for a round that exceeded the 2-hour timeout.
 * Reverts stake to player's contract withdrawable balance.
 */
export async function claimTimeout(roundId, network = NETWORK) {
  if (IS_MOCK_MODE || isMockMode()) {
    console.log("[CONTRACT MOCK] claimTimeout called for round:", roundId);
    if (mockClaimTimeoutError) {
      const errToThrow = typeof mockClaimTimeoutError === "string"
        ? new Error(mockClaimTimeoutError)
        : mockClaimTimeoutError;
      throw errToThrow;
    }
    markRoundClaimed(roundId);
    mockPlayerBalances.set("XLM", 100000n);
    return { hash: `mock_claim_${roundId}` };
  }

  const numericRoundId = BigInt(roundId);
  const playerAddress = (await getConnectedAddress()) || MOCK_ADDRESS;

  try {
    const res = await invokeSorobanMethod({
      method: "claim_timeout",
      args: [
        nativeToScVal(numericRoundId, { type: "u64" }),
      ],
      playerAddress,
      network,
    });
    markRoundClaimed(roundId);
    return res;
  } catch (err) {
    console.error("claimTimeout error:", err);
    throw new Error(mapContractError(err));
  }
}

/**
 * Checks whether an error indicates AlreadyResolved from the Soroban contract.
 * Contract enum: contracts/quiza/src/lib.rs:
 *   pub enum Error {
 *       AlreadyInitialized = 1,
 *       NotInitialized = 2,
 *       Paused = 3,
 *       InvalidScore = 4,
 *       InvalidAmount = 5,
 *       RoundNotFound = 6,
 *       Unauthorized = 7,
 *       AlreadyResolved = 8,
 *       TimeoutNotReached = 9,
 *       ZeroBalance = 10,
 *       InsufficientPoolLiquidity = 11,
 *       TokenNotAllowed = 12,
 *       ScoreResultMismatch = 13,
 *       StakeExceedsLimit = 14,
 *       StakeBelowLimit = 15,
 *   }
 * Soroban error format: Error(Contract, #8)
 */
export function isAlreadyResolvedError(err) {
  if (!err) return false;
  const msg = typeof err === "string" ? err : err?.message || String(err);
  return (
    /AlreadyResolved\b/i.test(msg) ||
    /Error\s*\(\s*Contract\s*,\s*#8\s*\)/.test(msg) ||
    msg.includes("already been resolved or refunded")
  );
}

/**
 * Fully claims a refund and withdraws it to the player's wallet:
 * 1. Executes claim_timeout on-chain to revert the stake to player contract balance.
 * 2. Executes withdraw on-chain to transfer tokens from contract to player wallet.
 * Returns { claimTxHash, withdrawTxHash }.
 * If claim succeeds but withdraw fails or is declined, throws error with .claimTxHash and .withdrawPending = true.
 */
export async function claimRefund(roundId, network = NETWORK) {
  const cfg = getNetworkConfig(network);
  const playerAddress = (await getConnectedAddress()) || MOCK_ADDRESS;

  // 1. Identify token contract address
  let tokenAddress = cfg.xlmContractId;
  const staked = getStakedRounds(playerAddress).find((r) => r.roundId.toString() === roundId.toString());
  if (staked?.token === "USDC") {
    tokenAddress = cfg.usdcContractId;
  } else {
    try {
      const onChain = await getRound(roundId, network);
      if (onChain?.token) {
        tokenAddress = typeof onChain.token === "string" ? onChain.token : onChain.token.toString();
      }
    } catch {}
  }

  // 2. Run claim_timeout
  let claimTxHash = null;
  let alreadyResolved = false;
  try {
    const claimRes = await claimTimeout(roundId, network);
    claimTxHash = claimRes?.hash || claimRes?.txHash || `mock_claim_${roundId}`;
  } catch (claimErr) {
    if (isAlreadyResolvedError(claimErr)) {
      alreadyResolved = true;
      markRoundClaimed(roundId);
      // Skip claim and inspect contract balance to determine if player won or lost
      const bal = await getBalance(playerAddress, tokenAddress, network);
      if (bal > 0n) {
        console.log(`Round ${roundId} was already resolved. Found contract balance of ${bal}. Proceeding straight to withdraw.`);
        claimTxHash = "already_resolved";
      } else {
        console.log(`Round ${roundId} was already resolved and contract balance is 0 (player lost or already withdrew).`);
        return {
          claimTxHash: "already_resolved",
          withdrawTxHash: null,
          won: false,
          zeroBalance: true,
          alreadyResolved: true,
        };
      }
    } else {
      throw claimErr;
    }
  }

  // 3. Withdraw for that round's token
  try {
    const withdrawRes = await withdrawWinnings(playerAddress, tokenAddress, network);
    const withdrawTxHash = withdrawRes?.hash || withdrawRes?.txHash || `mock_withdraw_${Date.now()}`;
    return {
      claimTxHash,
      withdrawTxHash,
      won: true,
      alreadyResolved,
    };
  } catch (withdrawErr) {
    console.warn("claim_timeout succeeded or skipped, but withdraw failed:", withdrawErr);
    const err = new Error(`Refund claimed on-chain, but withdrawal failed: ${withdrawErr?.message || withdrawErr}`);
    err.claimTxHash = claimTxHash;
    err.withdrawPending = true;
    err.tokenAddress = tokenAddress;
    throw err;
  }
}

/**
 * Retries withdrawing tokens from the contract to the player wallet
 * after claim_timeout has already credited the contract balance.
 */
export async function retryWithdrawRefund(tokenSymbolOrAddress, network = NETWORK) {
  const cfg = getNetworkConfig(network);
  const playerAddress = (await getConnectedAddress()) || MOCK_ADDRESS;
  const tokenAddress =
    tokenSymbolOrAddress === "USDC"
      ? cfg.usdcContractId
      : tokenSymbolOrAddress === "XLM" || !tokenSymbolOrAddress
      ? cfg.xlmContractId
      : tokenSymbolOrAddress;

  const withdrawRes = await withdrawWinnings(playerAddress, tokenAddress, network);
  return withdrawRes?.hash || withdrawRes?.txHash || `mock_withdraw_${Date.now()}`;
}

export const getRoundOnChain = getRound;

export function getExplorerTxUrl(txHash, network = NETWORK) {
  const cfg = getNetworkConfig(network);
  return `${cfg.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address, network = NETWORK) {
  const cfg = getNetworkConfig(network);
  return `${cfg.explorerUrl}/account/${address}`;
}

/**
 * Reads a player's withdrawable balance for a token from the contract.
 * Supports both getBalance(player, token) and getBalance(provider, player, token).
 * Returns BigInt stroops (e.g. 100000000n).
 */
export async function getBalance(arg1, arg2, arg3, network = NETWORK) {
  let playerAddress, tokenAddress;
  if (typeof arg1 === "string" && arg1.startsWith("G") && arg1.length === 56) {
    playerAddress = arg1;
    tokenAddress = arg2;
    if (typeof arg3 === "string" && STELLAR_NETWORKS[arg3]) {
      network = arg3;
    }
  } else if (typeof arg2 === "string" && (typeof arg3 === "string" || !arg3)) {
    // getBalance(provider, player, token, network)
    playerAddress = arg2;
    tokenAddress = arg3;
  } else {
    // getBalance(player, token, network)
    playerAddress = arg1;
    tokenAddress = arg2;
  }

  const cfg = getNetworkConfig(network);
  const targetToken = tokenAddress || cfg.xlmContractId;

  if (IS_MOCK_MODE || isMockMode()) {
    const sym = targetToken === cfg.usdcContractId ? "USDC" : "XLM";
    const b = mockPlayerBalances.get(sym) || 0n;
    console.log(`[CONTRACT MOCK] getBalance called for ${playerAddress} (${sym}):`, b.toString());
    return b;
  }

  if (!playerAddress || typeof playerAddress !== "string" || !playerAddress.startsWith("G")) {
    return 0n;
  }

  try {
    const rpcServer = getRpc(network);
    const contract = new Contract(cfg.contractId);
    // Read-only contract call simulation
    const callTx = new TransactionBuilder(
      new Account(playerAddress, "0"),
      { fee: "100", networkPassphrase: cfg.networkPassphrase }
    )
      .addOperation(
        contract.call(
          "get_balance",
          new Address(playerAddress).toScVal(),
          new Address(targetToken).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(callTx);
    if (sim?.result?.retval) {
      const val = scValToNative(sim.result.retval);
      return typeof val === "bigint" ? val : BigInt(val || 0);
    }
  } catch (e) {
    console.warn("Could not read contract balance:", e?.message);
  }
  return 0n;
}

// --- Query Helpers for Results & Game State -------------------------------

/**
 * Queries whether a round has been resolved on-chain.
 */
export async function isRoundResolved(roundId, network = NETWORK) {
  if (IS_MOCK_MODE) {
    console.log("[CONTRACT MOCK] isRoundResolved called for round:", roundId);
    return true;
  }

  const r = await getRound(roundId, network);
  return Boolean(r && r.resolved);
}

/**
 * Reads round details from the contract.
 */
export async function getRound(roundId, network = NETWORK) {
  if (IS_MOCK_MODE) {
    return {
      roundId,
      resolved: true,
      won: true,
      amount: 1000000n,
    };
  }

  const cfg = getNetworkConfig(network);
  const rpcServer = getRpc(network);
  const contract = new Contract(cfg.contractId);

  try {
    const dummyAccount = new Account(MOCK_ADDRESS, "0");
    const tx = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(
        contract.call("get_round", nativeToScVal(BigInt(roundId), { type: "u64" }))
      )
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    if (sim?.result?.retval) {
      return scValToNative(sim.result.retval);
    }
  } catch (e) {
    console.warn("Could not read round on-chain:", e?.message);
  }
  return null;
}

// --- Round Storage & Refund Helpers ---------------------------------------

const STAKED_ROUNDS_STORAGE_KEY = "quiza_staked_rounds";

export function getStakedRounds(address) {
  try {
    const raw = localStorage.getItem(STAKED_ROUNDS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (!address) return list;
    return list.filter((r) => r.address === address);
  } catch {
    return [];
  }
}

export function recordStakedRound(roundData) {
  try {
    const list = getStakedRounds();
    const roundIdStr = roundData.roundId.toString();
    const filtered = list.filter((r) => r.roundId !== roundIdStr);
    filtered.unshift({
      ...roundData,
      roundId: roundIdStr,
      timestamp: roundData.timestamp || Date.now(),
      claimed: false,
    });
    localStorage.setItem(STAKED_ROUNDS_STORAGE_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch (e) {
    console.warn("Could not save staked round to localStorage:", e);
  }
}

export function markRoundClaimed(roundId) {
  try {
    const list = getStakedRounds();
    const roundIdStr = roundId.toString();
    const updated = list.map((r) =>
      r.roundId === roundIdStr ? { ...r, claimed: true } : r
    );
    localStorage.setItem(STAKED_ROUNDS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export async function getRefundableRounds(address, network = NETWORK) {
  if (!address) return [];
  const staked = getStakedRounds(address);
  const now = Date.now();
  const refundable = [];
  const cfg = getNetworkConfig(network);

  for (const r of staked) {
    const ageSeconds = Math.floor((now - r.timestamp) / 1000);
    const tokenAddress = r.token === "USDC" ? cfg.usdcContractId : cfg.xlmContractId;

    if (r.claimed) {
      // Check if withdraw is still pending (contract balance > 0)
      const bal = await getBalance(address, tokenAddress, network);
      if (bal > 0n) {
        refundable.push({
          ...r,
          ageSeconds,
          withdrawPending: true,
          contractBalance: bal.toString(),
        });
      }
      continue;
    }

    // Only rounds older than 7200 seconds (2 hours)
    if (ageSeconds >= 7200) {
      try {
        const onChain = await getRound(r.roundId, network);
        if (onChain) {
          if (!onChain.resolved) {
            refundable.push({
              ...r,
              ageSeconds,
              onChain,
              withdrawPending: false,
            });
          } else {
            // Already resolved on-chain (e.g. claim_timeout called): check if balance > 0
            const bal = await getBalance(address, tokenAddress, network);
            if (bal > 0n) {
              refundable.push({
                ...r,
                ageSeconds,
                onChain,
                withdrawPending: true,
                contractBalance: bal.toString(),
              });
            }
          }
        }
      } catch (e) {
        console.warn(`Could not verify round ${r.roundId} on-chain:`, e);
      }
    }
  }

  // Also check if player has any contract balance for XLM / USDC not covered by staked rounds
  for (const sym of ["XLM", "USDC"]) {
    const tAddr = sym === "USDC" ? cfg.usdcContractId : cfg.xlmContractId;
    const b = await getBalance(address, tAddr, network);
    if (b > 0n && !refundable.some((r) => r.token === sym && r.withdrawPending)) {
      refundable.push({
        roundId: `balance-${sym.toLowerCase()}`,
        token: sym,
        amount: formatStroops(b),
        ageSeconds: 7200,
        withdrawPending: true,
        contractBalance: b.toString(),
      });
    }
  }

  return refundable;
}

// --- In-Memory Auth Session (Single Freighter Signature) --------------------

let currentAuthSession = null; // in memory only, not localStorage

export function clearAuthSession() {
  currentAuthSession = null;
}

export async function getOrCreateAuthSessionToken(address, network = NETWORK) {
  if (
    currentAuthSession &&
    currentAuthSession.address === address &&
    currentAuthSession.network === network &&
    currentAuthSession.expiresAt > Date.now() + 30000
  ) {
    return currentAuthSession.token;
  }

  if (IS_MOCK_MODE) {
    currentAuthSession = {
      token: "mock-session-token",
      address,
      network,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    return currentAuthSession.token;
  }

  // 1. Fetch challenge nonce from /api/challenge
  const challengeRes = await apiFetch(`/api/challenge?address=${encodeURIComponent(address)}`, {
    throwOnHttpError: false,
  });
  if (!challengeRes.ok) {
    throw new Error("Failed to request authentication challenge");
  }
  const challenge = await challengeRes.json();

  // 2. Sign message via Freighter signMessage
  // Follows Freighter SEP-53 message signing standard
  if (typeof window === "undefined" || !freighterApi?.signMessage) {
    throw new Error("Freighter wallet signMessage not available. Please install or enable Freighter.");
  }

  let signedResult;
  try {
    signedResult = await freighterApi.signMessage(challenge.message, { address });
  } catch (err) {
    throw new Error(`Freighter signature rejected or failed: ${err?.message || err}`);
  }

  if (signedResult?.error) {
    throw new Error(`Freighter signing error: ${signedResult.error?.message || signedResult.error}`);
  }

  // Freighter returns { signedMessage: string (base64 signature), signerAddress: string }
  let signature = signedResult.signedMessage || signedResult;
  if (typeof signature === "object" && signature !== null) {
    if (signature.type === "Buffer" && Array.isArray(signature.data)) {
      signature = btoa(String.fromCharCode.apply(null, signature.data));
    } else if (signature instanceof Uint8Array || ArrayBuffer.isView(signature)) {
      signature = btoa(String.fromCharCode.apply(null, new Uint8Array(signature)));
    }
  }

  // 3. Exchange signature for 15-minute session token via POST /api/session
  const sessionRes = await apiFetch("/api/session", {
    method: "POST",
    throwOnHttpError: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      nonce: challenge.nonce,
      signature,
    }),
  });

  if (!sessionRes.ok) {
    let errText = "Failed to authenticate session";
    try {
      const errJson = await sessionRes.json();
      if (errJson.error) errText = errJson.error;
    } catch {}
    throw new Error(errText);
  }

  const sessionData = await sessionRes.json();
  currentAuthSession = {
    token: sessionData.sessionToken,
    address,
    network,
    expiresAt: sessionData.expiresAt,
  };

  return currentAuthSession.token;
}

// --- Questions & Verification API Dispatch ---------------------------------

/**
 * Fetches round questions from API.
 * Practice mode: NO signature or popup.
 * Standard / Daily: uses single in-memory session token.
 */
export async function fetchRoundQuestions(params) {
  const { type, roundId, category, difficulty, walletAddress } = params;

  // Practice mode does NOT require a wallet signature or popup
  if (type === "practice") {
    return await apiFetch("/api/round-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundId: roundId?.toString(),
        type: "practice",
        category: category || "Mixed",
        difficulty: difficulty || "Mixed",
        walletAddress: walletAddress || "guest",
      }),
    });
  }

  // Daily and standard rounds require wallet signature / session token
  const sessionToken = await getOrCreateAuthSessionToken(walletAddress);

  return await apiFetch("/api/round-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      roundId: roundId?.toString(),
      type: type || "standard",
      category: category || "Mixed",
      difficulty: difficulty || "Mixed",
      walletAddress,
      sessionToken,
    }),
  });
}

/**
 * Polls GET /api/round-status if POST /api/verify-round times out or encounters network loss.
 * Polls every 3s for up to 2 minutes (120s) and returns the full result shape.
 */
async function pollRoundStatus(roundId, sessionToken, maxDurationMs = 120000, intervalMs = 3000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxDurationMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      const statusRes = await apiFetch(
        `/api/round-status?roundId=${encodeURIComponent(roundId)}`,
        {
          throwOnHttpError: false,
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
        }
      );
      if (statusRes.ok) {
        const data = await statusRes.json();
        if (data.status === "resolved" || data.status === "scored") {
          return {
            won: Boolean(data.won),
            correctCount: data.correctCount ?? data.score ?? 0,
            total: data.total ?? 5,
            txHash: data.txHash || null,
            correctAnswers: data.correctAnswers || null,
          };
        }
        if (data.status === "permanent_failure") {
          throw new Error(data.errorMessage || "Round verification permanently failed on-chain.");
        }
      }
    } catch (err) {
      if (err.message && err.message.includes("permanently failed")) throw err;
      // Continue polling through transient network errors
    }
  }
  return null;
}

/**
 * Submits round answers to the verifier API using the authenticated session token.
 */
export async function submitRoundForVerification({
  roundId,
  questionIds,
  submittedAnswers,
  address,
  secretToken,
}) {
  let sessionToken = await getOrCreateAuthSessionToken(address);

  let res = null;
  let networkOrTimeout = false;

  try {
    res = await apiFetch("/api/verify-round", {
      method: "POST",
      throwOnHttpError: false,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        roundId: roundId.toString(),
        questionIds,
        submittedAnswers,
        address,
        secretToken,
        sessionToken,
      }),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "NetworkError") {
      networkOrTimeout = true;
    } else {
      throw err;
    }
  }

  // Session edge case: If the 15-minute session expired between question loading and verification,
  // the server returns 401. Clear session cache, re-sign (1 popup), and retry once.
  if (res && res.status === 401) {
    clearAuthSession();
    sessionToken = await getOrCreateAuthSessionToken(address);
    try {
      res = await apiFetch("/api/verify-round", {
        method: "POST",
        throwOnHttpError: false,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          roundId: roundId.toString(),
          questionIds,
          submittedAnswers,
          address,
          secretToken,
          sessionToken,
        }),
      });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "NetworkError") {
        networkOrTimeout = true;
      } else {
        throw err;
      }
    }
  }

  // If verify-round POST timed out or network was lost, poll status instead of showing an error
  if (networkOrTimeout || (res && res.status >= 502)) {
    console.warn(`[verify-round] Network or timeout encountered on POST. Polling /api/round-status for round ${roundId}...`);
    const polledResult = await pollRoundStatus(roundId, sessionToken, 120000, 3000);
    if (polledResult) {
      return polledResult;
    }
    throw new Error("The game server took too long to complete your round. Please check your profile.");
  }

  if (!res.ok) {
    let errorMsg = "Verification request failed";
    try {
      const errorData = await res.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  return res.json();
}

// --- Account & Network Listeners ------------------------------------------

let accountListeners = new Set();
let networkListeners = new Set();

export function onAccountChange(handler) {
  accountListeners.add(handler);
  clearAuthSession();
  if (typeof window !== "undefined" && freighterApi?.WatchWalletChanges) {
    try {
      freighterApi.WatchWalletChanges((changes) => {
        if (changes?.address) {
          clearAuthSession();
          handler([changes.address]);
        }
      });
    } catch (e) {}
  }
}

export function onChainChange(handler) {
  networkListeners.add(handler);
  clearAuthSession();
}

export function removeWeb3Listeners() {
  accountListeners.clear();
  networkListeners.clear();
  clearAuthSession();
}
