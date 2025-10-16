import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "../environment";

describe("PrivacyPool multiple deposits", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("increments leaf index and updates root for multiple deposits", async function () {
    const { privacyPool, owner } = env;
    const amount = await privacyPool.DEPOSIT_AMOUNT();
    const leaves = [ethers.randomBytes(32), ethers.randomBytes(32), ethers.randomBytes(32)];

    const rootBefore = await privacyPool.merkleRoot();
    let lastRoot = rootBefore;
    for (let i = 0; i < leaves.length; i++) {
      const tx = await privacyPool.connect(owner).deposit(leaves[i], { value: amount });
      await tx.wait();
      const idx = await privacyPool.nextLeafIndex();
      expect(idx).to.equal(BigInt(i + 1));
      const root = await privacyPool.merkleRoot();
      expect(root).to.not.equal(lastRoot);
      lastRoot = root;
      const seen = await privacyPool.rootHistory(root);
      expect(seen).to.equal(true);
    }
  });
});

