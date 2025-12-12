// test/zk-proof-generation.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "../environment";
import {
  generateNote,
  parseNote,
  generateCommitment,
  generateNullifierHash,
  CircuitCompatibleMerkleTree,
} from "../../frontend/src/utils/crypto";
// @ts-ignore
import { groth16 } from "snarkjs";
import { PrivacyPool } from "../../typechain-types";
import { Signer } from "ethers";
import * as fs from "fs";
import * as path from "path";

const isCoverage = !!process.env.SOLIDITY_COVERAGE;
const TREE_DEPTH = 16;
const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ZERO_VALUE_HEX = (() => {
  const seedHashHex = ethers.keccak256(ethers.toUtf8Bytes("PrivacyPool-Zero"));
  const zeroBigInt = BigInt(seedHashHex) % SNARK_SCALAR_FIELD;
  return "0x" + zeroBigInt.toString(16).padStart(64, "0");
})();

describe("ZK Proof Generation", function () {
  let env: TestEnvironment;
  let privacyPool: PrivacyPool;
  let owner: Signer;

  beforeEach(async function () {
    this.timeout(60000); // Increase timeout for fixture loading with ZK components
    env = await loadFixture(deployTestEnvironment);
    privacyPool = env.privacyPool;
    owner = env.owner;
  });

  (isCoverage ? it.skip : it)("should generate a valid proof for a simple withdrawal", async function () {
    // 1. Create a note and deposit
    const note = generateNote();
    const { secret } = parseNote(note);
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    const commitmentHex = await generateCommitment(secret, depositAmount.toString());

    await privacyPool
      .connect(owner)
      .deposit(commitmentHex, { value: depositAmount });

    // 2. Build the Merkle tree from events
    const depositEvents = await privacyPool.queryFilter(
      privacyPool.filters.Deposit()
    );
    const commitments = depositEvents.map((event) => event.args.commitment!);
    const tree = new CircuitCompatibleMerkleTree(TREE_DEPTH, commitments, ZERO_VALUE_HEX);
    await tree.initialize();
    expect(tree.getRoot()).to.equal(await privacyPool.merkleRoot());

    // 3. Generate the Merkle path
    const leafIndex = commitments.findIndex((c) => c === commitmentHex);
    expect(leafIndex).to.not.equal(-1);
    const merkleProof = tree.generateProof(leafIndex);

    // 4. Prepare inputs for the circuit (circuit derives nullifier/root internally)
    const input = {
      secret: BigInt(secret),
      amount: BigInt(depositAmount.toString()),
      pathElements: merkleProof.pathElements.map((el) => BigInt(el)),
      pathIndices: merkleProof.pathIndices,
    };

    // 5. Generate the proof
    try {
      const wasmPath = path.join(process.cwd(), "circuits", "withdraw_js", "withdraw.wasm");
      const zkeyPath = path.join(process.cwd(), "circuits", "withdraw_0001.zkey");

      const { proof, publicSignals } = await groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
      );

      expect(proof).to.not.be.null;
      expect(publicSignals).to.not.be.null;
    } catch (error) {
      console.error("ZK Proof Generation Failed (simple). Inputs:", input);
      throw error;
    }
  });
});
