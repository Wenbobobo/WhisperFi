import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "../environment";
import { CircuitCompatibleMerkleTree } from "../../frontend/src/utils/crypto";

const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const ZERO_VALUE_HEX = (() => {
  const seed = ethers.toUtf8Bytes("PrivacyPool-Zero");
  const hashHex = ethers.keccak256(seed);
  const zeroBigInt = BigInt(hashHex) % SNARK_SCALAR_FIELD;
  return "0x" + zeroBigInt.toString(16).padStart(64, "0");
})();

describe("CircuitCompatibleMerkleTree", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("matches on-chain merkle root after sequential deposits", async function () {
    const { privacyPool, owner } = env;
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    const commitments: string[] = [];
    for (let i = 0; i < 3; i++) {
      const commitment = ethers.randomBytes(32);
      await privacyPool
        .connect(owner)
        .deposit(commitment, { value: depositAmount });
      commitments.push(ethers.hexlify(commitment));
    }

    const contractRoot = await privacyPool.merkleRoot();
    const tree = new CircuitCompatibleMerkleTree(16, commitments, ZERO_VALUE_HEX);
    await tree.initialize();

    expect(tree.getRoot()).to.equal(contractRoot);
  });

  it("produces circuit-compatible paths that verify against the computed root", async function () {
    const { privacyPool, owner } = env;
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    const insertCommitments: string[] = [];
    for (let i = 0; i < 2; i++) {
      const commitment = ethers.randomBytes(32);
      await privacyPool
        .connect(owner)
        .deposit(commitment, { value: depositAmount });
      insertCommitments.push(ethers.hexlify(commitment));
    }

    const tree = new CircuitCompatibleMerkleTree(16, insertCommitments, ZERO_VALUE_HEX);
    await tree.initialize();
    const { pathElements, pathIndices } = tree.generateProof(1);

    const isValid = await tree.verifyProof(
      insertCommitments[1],
      pathElements,
      pathIndices,
      tree.getRoot()
    );

    expect(isValid).to.equal(true);
  });
});
