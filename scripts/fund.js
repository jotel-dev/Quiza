import hre from "hardhat";

async function main() {
  const address = "0x97E6C7a55d95027FC3d891Fa4897DE4dF4773094";
  const Quiza = await hre.ethers.getContractFactory("Quiza");
  const quiza = Quiza.attach(address);

  console.log("Funding pool with 0.1 CELO...");
  const tx = await quiza.fundPoolCelo({ value: hre.ethers.parseEther("0.1") });
  await tx.wait();
  console.log("Successfully funded CELO pool!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
