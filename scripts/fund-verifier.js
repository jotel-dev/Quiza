import hre from "hardhat";
import * as dotenv from "dotenv";
import { Wallet, ethers } from "ethers";

dotenv.config();

async function fundVerifier() {
  const { ethers: hardhatEthers, network } = hre;
  
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY is missing from your .env file!");
  }

  // Get target verifier address from .env or derive from verifier private key
  let verifierAddress = process.env.QUIZA_VERIFIER_ADDRESS;
  if (!verifierAddress && process.env.QUIZA_VERIFIER_PRIVATE_KEY) {
    try {
      verifierAddress = new Wallet(process.env.QUIZA_VERIFIER_PRIVATE_KEY).address;
    } catch (e) {}
  }
  
  // Fallback to hardcoded address if not found in .env
  if (!verifierAddress) {
    verifierAddress = "0x22baf440fF5eFB18015413D2Bb4FDFC8b63a6484";
  }

  const [signer] = await hardhatEthers.getSigners();
  const signerAddress = await signer.getAddress();
  const balance = await hardhatEthers.provider.getBalance(signerAddress);

  console.log(`📡 Network: ${network.name}`);
  console.log(`🔑 Deployer/Funder Address: ${signerAddress}`);
  console.log(`💰 Deployer Balance: ${ethers.formatEther(balance)} CELO`);
  console.log(`🎯 Target Verifier Address: ${verifierAddress}`);

  const verifierBalance = await hardhatEthers.provider.getBalance(verifierAddress);
  console.log(`📊 Current Verifier Balance: ${ethers.formatEther(verifierBalance)} CELO`);

  // Default funding amount (e.g. 0.2 CELO)
  const amountToFund = process.env.FUND_AMOUNT || "0.2";
  console.log(`\n⏳ Sending ${amountToFund} CELO to Verifier...`);

  const tx = await signer.sendTransaction({
    to: verifierAddress,
    value: ethers.parseEther(amountToFund),
  });

  console.log(`🚀 Transaction submitted! Hash: ${tx.hash}`);
  await tx.wait();

  const newBalance = await hardhatEthers.provider.getBalance(verifierAddress);
  console.log(`✅ Success! New Verifier Balance: ${ethers.formatEther(newBalance)} CELO`);
}

fundVerifier().catch((err) => {
  console.error("❌ Error funding verifier:", err.message);
  process.exit(1);
});
