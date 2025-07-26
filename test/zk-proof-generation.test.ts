// test/zk-proof-generation.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "./environment";
import { generateNote, parseNote, generateCommitment, generateNullifierHash } from "../frontend/src/utils/crypto";
import { MerkleTree } from "fixed-merkle-tree";
const poseidon = require("circomlibjs").poseidon;
// @ts-ignore
import { groth16 } from "snarkjs";
import { PrivacyPool } from "../typechain-types";
import { Signer } from "ethers";
import * as fs from "fs";
import * as path from "path";

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

  it("should generate a valid proof for a valid deposit", async function () {
    // 1. Create a note and deposit
    const note = generateNote();
    const { secret, nullifier } = parseNote(note);
    const commitment = await generateCommitment(secret, nullifier, ethers.parseEther("0.1").toString());
    await privacyPool.connect(owner).deposit(commitment, { value: ethers.parseEther("0.1") });

    // 2. Build the Merkle tree from events
    const depositEvents = await privacyPool.queryFilter(privacyPool.filters.Deposit());
    const commitments = depositEvents.map(event => event.args.commitment);
    const tree = new MerkleTree(20, commitments, { hashFunction: (a, b) => poseidon([a, b]), zeroElement: "0" });

    // 3. Generate the Merkle path
    const leafIndex = commitments.findIndex(c => c === commitment);
    const { pathElements, pathIndices } = tree.path(leafIndex);

    // 4. Prepare inputs for the circuit
    const nullifierHash = await generateNullifierHash(secret);
    const input = {
      secret: secret,
      nullifier: nullifier,
      amount: ethers.parseEther("0.1").toString(),
      pathElements: pathElements,
      pathIndices: pathIndices,
      merkleRoot: tree.root,
      nullifierHash: nullifierHash,
    };

    // 5. Generate the proof
    try {
      const wasmPath = path.join(__dirname, "../circuits/withdraw_js/withdraw.wasm");
      const zkeyPath = path.join(__dirname, "../circuits/deposit_0001.zkey");

      const wasmBytes = fs.readFileSync(wasmPath);
      const zkeyBytes = fs.readFileSync(zkeyPath);

      const { proof, publicSignals } = await groth16.fullProve(
        input,
        wasmBytes,
        zkeyBytes
      );
      // If we reach here, the proof generation was successful
      expect(proof).to.not.be.null;
      expect(publicSignals).to.not.be.null;
    } catch (error) {
      // This will catch any errors from snarkjs and fail the test
      console.error("ZK Proof Generation Failed:", error);
      console.log("Circuit Inputs:", input);
      throw error;
    }
  });
});
