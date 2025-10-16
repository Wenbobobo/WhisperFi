import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "../environment";

describe("PrivacyPool guards", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("reverts on wrong deposit amount", async function () {
    const { privacyPool, owner } = env;
    const wrong = ethers.parseEther("0.09");
    await expect(
      privacyPool.connect(owner).deposit(ethers.randomBytes(32), { value: wrong })
    ).to.be.revertedWith("Invalid deposit amount");
  });

  it("prevents double spend via nullifier reuse", async function () {
    const { privacyPool, owner, verifier } = env;
    const commitment = ethers.randomBytes(32);
    const amount = await privacyPool.DEPOSIT_AMOUNT();
    await privacyPool.connect(owner).deposit(commitment, { value: amount });
    const root = await privacyPool.merkleRoot();

    // First withdraw succeeds with mock verifier
    const pA: [string, string] = ["0", "0"];
    const pB: [[string, string], [string, string]] = [
      ["0", "0"],
      ["0", "0"],
    ];
    const pC: [string, string] = ["0", "0"];
    const nullifier = ethers.randomBytes(32);
    const recipient = await owner.getAddress();

    await privacyPool.withdraw(pA, pB, pC, root, nullifier, recipient, 0, recipient);

    // Second withdraw with same nullifier should revert
    await expect(
      privacyPool.withdraw(pA, pB, pC, root, nullifier, recipient, 0, recipient)
    ).to.be.revertedWith("Nullifier has been used");
  });
});

