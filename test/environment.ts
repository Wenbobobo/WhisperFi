// test/environment.ts
import { ethers } from "hardhat";
import fs from "fs/promises";
import path from "path";

export async function setupEnvironment() {
  const [owner, user, bundler] = await ethers.getSigners();

  // Deploy all contracts, ensuring all constructor arguments are address strings
  const entryPointFactory = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await entryPointFactory.deploy();
  await entryPoint.waitForDeployment();
  const entryPointAddress = await entryPoint.getAddress();

  const verifierFactory = await ethers.getContractFactory("Verifier");
  const verifier = await verifierFactory.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();

  const privacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
  const privacyPool = await privacyPoolFactory.deploy(verifierAddress, await owner.getAddress());
  await privacyPool.waitForDeployment();

  const factoryFactory = await ethers.getContractFactory("SmartAccountFactory");
  const factory = await factoryFactory.deploy(entryPointAddress);
  await factory.waitForDeployment();

  const paymasterFactory = await ethers.getContractFactory("Paymaster");
  const paymaster = await paymasterFactory.deploy(entryPointAddress, await owner.getAddress());
  await paymaster.waitForDeployment();

  // ... (rest of the function remains the same)

  // Write addresses to a test-specific config file
  const config = {
    entryPoint: await entryPoint.getAddress(),
    verifier: await verifier.getAddress(),
    privacyPool: await privacyPool.getAddress(),
    smartAccountFactory: await factory.getAddress(),
    paymaster: await paymaster.getAddress(),
  };

  const configPath = path.join(__dirname, "test-contracts.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  return {
    owner,
    user,
    bundler,
    entryPoint,
    verifier,
    privacyPool,
    factory,
    paymaster,
  };
}
