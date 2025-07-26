import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "./environment";
import { Signer } from "ethers";
import { Executor } from "../typechain-types";

describe("Executor", function () {
  let env: TestEnvironment;
  let owner: Signer;
  let notOwner: Signer;
  let executor: Executor; // Assuming Executor is a type from typechain

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
    owner = env.owner;
    notOwner = env.user; // Use 'user' as the non-owner for tests
    
    // The Executor contract is not part of the standard TestEnvironment.
    // We need to deploy it separately for this test suite.
    const executorFactory = await ethers.getContractFactory("Executor");
    executor = await executorFactory.deploy(await owner.getAddress());
    await executor.waitForDeployment();
  });

  it("should be owned by the deployer", async function () {
    expect(await executor.owner()).to.equal(await owner.getAddress());
  });

  it("should not allow non-owner to execute", async function () {
    const target = await owner.getAddress();
    const callData = "0x";
    await expect(
      executor.connect(notOwner).execute(target, callData)
    ).to.be.revertedWithCustomError(executor, "OwnableUnauthorizedAccount").withArgs(await notOwner.getAddress());
  });

  it("should allow owner to execute", async function () {
    const target = await owner.getAddress();
    const callData = "0x";
    await expect(executor.connect(owner).execute(target, callData)).to.not.be.reverted;
  });
});