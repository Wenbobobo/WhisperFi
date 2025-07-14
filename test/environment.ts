// test/environment.ts
import { ethers } from "hardhat";
import fs from "fs/promises";
import path from "path";

export async function setupEnvironment() {
  const [owner, user, bundler] = await ethers.getSigners();

  // Deploy all contracts
  const EntryPoint = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await EntryPoint.deploy();
  await entryPoint.waitForDeployment();

  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();

  const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
  const privacyPool = await PrivacyPool.deploy(await verifier.getAddress(), ethers.ZeroHash);
  await privacyPool.waitForDeployment();

  const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactory");
  const factory = await SmartAccountFactory.deploy(await entryPoint.getAddress());
  await factory.waitForDeployment();

  const Paymaster = await ethers.getContractFactory("Paymaster");
  const paymaster = await Paymaster.deploy(await entryPoint.getAddress(), await owner.getAddress());
  await paymaster.waitForDeployment();

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
