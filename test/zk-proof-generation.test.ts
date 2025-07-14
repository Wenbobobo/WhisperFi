// test/zk-proof-generation.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { setupEnvironment } from "./environment";
import { generateNote, parseNote, generateCommitment, generateNullifierHash } from "../frontend/src/utils/crypto";
import { MerkleTree } from "fixed-merkle-tree";
import { poseidon } from "circomlibjs";
// @ts-ignore
import { groth16 } from "snarkjs";

describe("ZK Proof Generation", function () {
  it("should generate a valid proof for a valid deposit", async function () {
    this.timeout(60000); // Increase timeout for ZK proof generation

    const { privacyPool, owner } = await setupEnvironment();

    // 1. Create a note and deposit
    const note = generateNote();
    const { secret, nullifier } = parseNote(note);
    const commitment = await generateCommitment(secret, ethers.parseEther("0.1").toString());
    await privacyPool.connect(owner).deposit(commitment, { value: ethers.parseEther("0.1") });

    // 2. Build the Merkle tree from events
    const depositEvents = await privacyPool.queryFilter("Deposit");
    const commitments = depositEvents.map(event => event.args.commitment);
    const tree = new MerkleTree(20, commitments, { hashFunction: poseidon, zeroElement: ethers.ZeroHash });

    // 3. Generate the Merkle path
    const leafIndex = commitments.findIndex(c => c === commitment);
    const { pathElements, pathIndices } = tree.path(leafIndex);

    // 4. Prepare inputs for the circuit
    const nullifierHash = await generateNullifierHash(secret);
    const input = {
      secret: secret,
      amount: ethers.parseEther("0.1").toString(),
      pathElements: pathElements,
      pathIndices: pathIndices,
      merkleRoot: tree.root,
      nullifier: nullifierHash,
    };

    // 5. Generate the proof
    try {
      const { proof, publicSignals } = await groth16.fullProve(
        input,
        "circuits/withdraw_js/withdraw.wasm",
        "circuits/deposit_0001.zkey"
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
