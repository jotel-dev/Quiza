import { BrowserProvider, JsonRpcProvider, Contract, parseEther, parseUnits, formatEther, formatUnits } from "ethers";

// --- Network config -----------------------------------------------------
const getNetwork = () => {
  if (typeof process !== "undefined" && process.env && process.env.QUIZA_NETWORK) {
    return process.env.QUIZA_NETWORK;
  }
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_QUIZA_NETWORK) {
    return import.meta.env.VITE_QUIZA_NETWORK;
  }
  return "mainnet";
};
export const NETWORK = getNetwork();

export const CELO_NETWORKS = {
  alfajores: {
    chainId: "0xaef3", // 44787
    chainName: "Celo Alfajores Testnet",
    rpcUrls: ["https://alfajores-forno.celo-testnet.org"],
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    blockExplorerUrls: ["https://alfajores.celoscan.io"],
  },
  mainnet: {
    chainId: "0xa4ec", // 42220
    chainName: "Celo Mainnet",
    rpcUrls: ["https://forno.celo.org"],
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    blockExplorerUrls: ["https://celoscan.io"],
  },
};

// Fill these in after deployment (see docs/DEPLOY.md)
export const QUIZA_CONTRACT_ADDRESS = {
  alfajores: "0xYOUR_TESTNET_CONTRACT_ADDRESS",
  mainnet: "0x81f2150e2aa7A28c788Ee8D3A2609f03566C5142",
};

// cUSD token addresses (fixed, published by Celo)
export const CUSD_ADDRESS = {
  alfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  mainnet: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
};

// Minimal ABI — only the functions/events the frontend needs
export const QUIZA_ABI = [
  "function stakeCelo() external payable returns (uint256 roundId)",
  "function stakeToken(address token, uint256 amount) external returns (uint256 roundId)",
  "function withdraw(address token) external",
  "function balances(address player, address token) external view returns (uint256)",
  "function rounds(uint256 roundId) external view returns (address player, address token, uint256 amount, bool resolved, bool won)",
  "event Staked(uint256 indexed roundId, address indexed player, address token, uint256 amount)",
  "event Resolved(uint256 indexed roundId, address indexed player, bool won, uint256 payout)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
];

// --- Connection -----------------------------------------------------------

/**
 * Connects to the wallet injected by MiniPay (or any EIP-1193 wallet as fallback).
 * Returns { provider, signer, address, isMiniPay }.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Open this app inside MiniPay or install a Celo-compatible wallet.");
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  let isMiniPay = false;
  try {
    const isMiniPayFlag = await window.ethereum.request({ method: "minipay_getIsMiniPay" });
    isMiniPay = Boolean(isMiniPayFlag);
  } catch {
    isMiniPay = /MiniPay/i.test(navigator.userAgent);
  }

  return { provider, signer, address, isMiniPay };
}

/** Ensures the wallet is on the expected Celo network, prompting a switch if not. */
export async function ensureNetwork(network = NETWORK) {
  if (!window.ethereum) return;
  const cfg = CELO_NETWORKS[network];
  try {
    const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
    if (currentChainId && currentChainId.toLowerCase() === cfg.chainId.toLowerCase()) {
      return; // Already on the expected network
    }

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: cfg.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [cfg],
      });
    } else if (switchError.code === -32601) {
      console.warn("Wallet doesn't support network switching (e.g., MiniPay). Assuming correct network.");
    } else {
      throw switchError;
    }
  }
}

/** Returns native CELO and cUSD balances for an address. */
export async function getWalletBalances(provider, address, network = NETWORK) {
  // Use a direct RPC provider to bypass wallet rate limits for read operations
  const rpcUrl = CELO_NETWORKS[network].rpcUrls[0];
  const directProvider = new JsonRpcProvider(rpcUrl);

  const cusd = new Contract(CUSD_ADDRESS[network], ERC20_ABI, directProvider);
  const celoBalance = await directProvider.getBalance(address);
  const cusdBalance = await cusd.balanceOf(address);
  
  return {
    CELO: parseFloat(formatEther(celoBalance)).toFixed(4),
    cUSD: parseFloat(formatUnits(cusdBalance, 18)).toFixed(4),
  };
}

function getContract(signer, network = NETWORK) {
  return new Contract(QUIZA_CONTRACT_ADDRESS[network], QUIZA_ABI, signer);
}

// --- Staking ----------------------------------------------------------

/** Stake native CELO to start a round. Returns the transaction receipt. */
export async function stakeCelo(signer, amountInCelo = "0.01", network = NETWORK) {
  const contract = getContract(signer, network);
  const tx = await contract.stakeCelo({ value: parseEther(amountInCelo) });
  const receipt = await tx.wait();
  return receipt;
}

/** Stake cUSD — requires an approval step first since it's an ERC20. */
export async function stakeCUSD(signer, amountInCUSD = "0.01", network = NETWORK) {
  const cusd = new Contract(CUSD_ADDRESS[network], ERC20_ABI, signer);
  const amount = parseUnits(amountInCUSD, 18);
  const owner = await signer.getAddress();

  const allowance = await cusd.allowance(owner, QUIZA_CONTRACT_ADDRESS[network]);
  if (allowance < amount) {
    const approveTx = await cusd.approve(QUIZA_CONTRACT_ADDRESS[network], amount);
    await approveTx.wait();
  }

  const contract = getContract(signer, network);
  const tx = await contract.stakeToken(CUSD_ADDRESS[network], amount);
  const receipt = await tx.wait();
  return receipt;
}

/** Extracts the roundId from a stake transaction receipt's Staked event. */
export function getRoundIdFromReceipt(receipt, network = NETWORK) {
  const iface = new Contract(QUIZA_CONTRACT_ADDRESS[network], QUIZA_ABI).interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === "Staked") return parsed.args.roundId;
    } catch {
      // not a Quiza event, skip
    }
  }
  return null;
}

// --- Payout -------------------------------------------------------------

/** Withdraws any accumulated winnings for a given token. */
export async function withdrawWinnings(signer, tokenAddress, network = NETWORK) {
  const contract = getContract(signer, network);
  const tx = await contract.withdraw(tokenAddress);
  return tx.wait();
}

/** Reads a player's withdrawable balance for a token (CELO_NATIVE = zero address). */
export async function getBalance(provider, playerAddress, tokenAddress, network = NETWORK) {
  const contract = new Contract(QUIZA_CONTRACT_ADDRESS[network], QUIZA_ABI, provider);
  return contract.balances(playerAddress, tokenAddress);
}

// --- Calling the backend verifier after a quiz round --------------------

/**
 * After the player finishes answering, submit their answers to our backend
 * to be checked against the source-of-truth question bank. The backend then
 * calls resolve(roundId, won) on-chain using the trusted verifier key.
 */
export async function submitRoundForVerification({ roundId, questionIds, submittedAnswers, address }) {
  const res = await fetch("/api/verify-round", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundId: roundId.toString(), questionIds, submittedAnswers, address }),
  });
  if (!res.ok) throw new Error("Verification request failed");
  return res.json(); // { won: boolean, correctCount: number, txHash: string }
}

// --- Web3 listeners -----------------------------------------------------

let accountChangeHandler = null;
let chainChangeHandler = null;

export function onAccountChange(handler) {
  accountChangeHandler = handler;
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accountChangeHandler) accountChangeHandler(accounts);
    });
  }
}

export function onChainChange(handler) {
  chainChangeHandler = handler;
  if (window.ethereum) {
    window.ethereum.on("chainChanged", (chainId) => {
      if (chainChangeHandler) chainChangeHandler(chainId);
    });
  }
}

export function removeWeb3Listeners() {
  if (window.ethereum) {
    window.ethereum.removeListener("accountsChanged", accountChangeHandler);
    window.ethereum.removeListener("chainChanged", chainChangeHandler);
  }
  accountChangeHandler = null;
  chainChangeHandler = null;
}
