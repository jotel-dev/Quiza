// scripts/deploy.cjs
// Deploys Quiza.sol to whichever network Hardhat is pointed at.
//
// Usage:
//   npx hardhat run scripts/deploy.cjs --network alfajores
//   npx hardhat run scripts/deploy.cjs --network celo

const hre = require("hardhat");

// cUSD token addresses (fixed, published by Celo — do not change)
const CUSD_ADDRESS = {
  alfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
};

async function main() {
  const network = hre.network.name;
  const cUSD = CUSD_ADDRESS[network];
  if (!cUSD) throw new Error(`No cUSD address configured for network: ${network}`);

  // The verifier address is the wallet your backend (verifyRound.js) uses to call resolve().
  // For testnet you can reuse your deployer wallet; for mainnet use a dedicated backend key.
  const verifierAddress = process.env.QUIZA_VERIFIER_ADDRESS;
  if (!verifierAddress) {
    throw new Error("Set QUIZA_VERIFIER_ADDRESS in your .env before deploying");
  }

  console.log(`Deploying Quiza to ${network}...`);
  console.log(`  cUSD address: ${cUSD}`);
  console.log(`  Verifier address: ${verifierAddress}`);

  const Quiza = await hre.ethers.getContractFactory("Quiza");
  const quiza = await Quiza.deploy(cUSD, verifierAddress);
  await quiza.waitForDeployment();

  const address = await quiza.getAddress();
  console.log(`\n✅ Quiza deployed to: ${address}`);
  console.log(`\nNext steps:`);
  console.log(`1. Update QUIZA_CONTRACT_ADDRESS.${network} in frontend/src/lib/quizaContract.js to: ${address}`);
  console.log(`2. Fund the contract's reward pool (fundPoolCelo / fundPoolToken) so payouts don't fail`);
  console.log(`3. Verify the contract:`);
  console.log(`   npx hardhat verify --network ${network} ${address} ${cUSD} ${verifierAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
