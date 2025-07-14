// test/PoseidonMerkleTree.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { buildPoseidon } from "circomlibjs";

describe("PoseidonMerkleTree", function () {
  let merkleTree: Contract;
  let poseidon: any;

  beforeEach(async function () {
    poseidon = await buildPoseidon();
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
    let jsRoot = poseidon([leaf1, leaf2]);
    for (let i = 1; i < 20; i++) {
      jsRoot = poseidon([jsRoot, 0]);
    }

    expect(root).to.equal(ethers.toBeHex(poseidon.F.toObject(jsRoot)));
  });
});
