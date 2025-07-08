// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Verifier
  const verifier = await ethers.deployContract("Verifier");
  await verifier.waitForDeployment();
  console.log("Verifier deployed to:", await verifier.getAddress());

  // Deploy Executor
  const executor = await ethers.deployContract("Executor", [deployer.address]);
  await executor.waitForDeployment();
  console.log("Executor deployed to:", await executor.getAddress());
  
  // Deploy PrivacyPool
  const zeroValue = ethers.encodeBytes32String("zero");
  const privacyPool = await ethers.deployContract("PrivacyPool", [
    await verifier.getAddress(),
    zeroValue,
    deployer.address
  ]);
  await privacyPool.waitForDeployment();
  console.log("PrivacyPool deployed to:", await privacyPool.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
