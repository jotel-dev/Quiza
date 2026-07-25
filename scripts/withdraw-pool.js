// scripts/withdraw-pool.js
// Allows the contract owner to withdraw unused CELO or token funds from the Quiza pool.
//
// Usage:
//   npx hardhat run scripts/withdraw-pool.js --network alfajores
//   npx hardhat run scripts/withdraw-pool.js --network celo

import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const network = hre.network.name;
  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  const contractAddress = process.env.QUIZA_CONTRACT_ADDRESS || (network === "mainnet" || network === "celo" ? "0x81f2150e2aa7A28c788Ee8D3A2609f03566C5142" : null);

  if (!contractAddress) {
    throw new Error("QUIZA_CONTRACT_ADDRESS is not set in environment or script!");
  }

  console.log(`📡 Network: ${network}`);
  console.log(`🔑 Owner/Signer Address: ${signerAddress}`);
  console.log(`🎯 Quiza Contract Address: ${contractAddress}`);

  const Quiza = await hre.ethers.getContractFactory("Quiza");
  const quiza = Quiza.attach(contractAddress);

  const balance = await hre.ethers.provider.getBalance(contractAddress);
  console.log(`💰 Current Contract CELO Balance: ${hre.ethers.formatEther(balance)} CELO`);

  const withdrawAmount = process.env.WITHDRAW_AMOUNT || "0.1";
  console.log(`\n⏳ Requesting withdrawal of ${withdrawAmount} CELO from pool to owner...`);

  const tx = await quiza.withdrawPoolCelo(hre.ethers.parseEther(withdrawAmount));
  console.log(`🚀 Transaction submitted! Hash: ${tx.hash}`);
  await tx.wait();

  console.log(`✅ Success! Pool withdrawal confirmed.`);
}

main().catch((error) => {
  console.error("❌ Error withdrawing pool funds:", error.message);
  process.exitCode = 1;
});
