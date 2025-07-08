import { expect } from "chai";
import { ethers } from "hardhat";

describe("Executor", function () {
  let owner, notOwner, executor;

  beforeEach(async function () {
    [owner, notOwner] = await ethers.getSigners();
    const Executor = await ethers.getContractFactory("Executor");
    executor = await Executor.deploy(await owner.getAddress());
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
    await expect(executor.execute(target, callData)).to.not.be.reverted;
  });
});