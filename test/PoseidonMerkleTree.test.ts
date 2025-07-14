// test/PoseidonMerkleTree.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { poseidon } from "circomlibjs";

describe("PoseidonMerkleTree", function () {
  let merkleTree: Contract;

  beforeEach(async function () {
    const PoseidonMerkleTree = await ethers.getContractFactory("PoseidonMerkleTree");
    merkleTree = await PoseidonMerkleTree.deploy();
    await merkleTree.waitForDeployment();
  });

  it("should correctly calculate the root", async function () {
    const leaf1 = ethers.randomBytes(32);
    const leaf2 = ethers.randomBytes(32);

    await merkleTree.insert(leaf1);
    await merkleTree.insert(leaf2);

    const root = await merkleTree.getRoot();

    // Calculate the root manually in JS to verify
    const jsRoot = poseidon([poseidon([leaf1, leaf2]), 0]); // Simplified for 2 leaves

    expect(root).to.equal(ethers.hexlify(jsRoot));
  });
});
