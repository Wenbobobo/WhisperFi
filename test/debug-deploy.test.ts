// test/debug-deploy.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Debug Deployment", function () {
  it("should deploy all contracts without resolveName error", async function () {
    const [owner, user] = await ethers.getSigners();
    
    console.log("Deploying EntryPoint...");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    console.log("EntryPoint deployed to:", await entryPoint.getAddress());

    console.log("Deploying Verifier...");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    console.log("Verifier deployed to:", await verifier.getAddress());

    console.log("Deploying PrivacyPool...");
    const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
    const privacyPool = await PrivacyPool.deploy(
      await verifier.getAddress(),
      await owner.getAddress()
    );
    await privacyPool.waitForDeployment();
    console.log("PrivacyPool deployed to:", await privacyPool.getAddress());

    console.log("Deploying SmartAccount...");
    const SmartAccount = await ethers.getContractFactory("SmartAccount");
    const smartAccount = await SmartAccount.deploy(
      await entryPoint.getAddress(),
      await user.getAddress()
    );
    await smartAccount.waitForDeployment();
    console.log("SmartAccount deployed to:", await smartAccount.getAddress());

    console.log("Deploying Paymaster...");
    const Paymaster = await ethers.getContractFactory("Paymaster");
    const paymaster = await Paymaster.deploy(
      await entryPoint.getAddress(),
      await owner.getAddress()
    );
    await paymaster.waitForDeployment();
    console.log("Paymaster deployed to:", await paymaster.getAddress());

    console.log("All contracts deployed successfully!");
    
    // Basic functionality test
    expect(await smartAccount.owner()).to.equal(await user.getAddress());
    expect(await smartAccount.entryPoint()).to.equal(await entryPoint.getAddress());
  });
});
