// test/zk-proof-generation.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "./environment";
import {
  generateNote,
  parseNote,
  generateCommitment,
  generateNullifierHash,
  CircuitCompatibleMerkleTree,
} from "../frontend/src/utils/crypto";
import { buildPoseidon } from "circomlibjs";
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
  let poseidon: any;

  before(async function () {
    // Initialize Poseidon hasher - this ensures consistency with frontend crypto.ts
    poseidon = await buildPoseidon();
  });

  beforeEach(async function () {
    this.timeout(60000); // Increase timeout for fixture loading with ZK components
    env = await loadFixture(deployTestEnvironment);
    privacyPool = env.privacyPool;
    owner = env.owner;
  });

  it("should generate a valid proof for a valid deposit", async function () {
    // 1. Create a note and deposit
    const note = generateNote();
    const { secret } = parseNote(note);
    const commitment = await generateCommitment(
      secret,
      ethers.parseEther("0.1").toString()
    );
    await privacyPool
      .connect(owner)
      .deposit(commitment, { value: ethers.parseEther("0.1") });

    // 2. Build the Merkle tree from events
    const depositEvents = await privacyPool.queryFilter(
      privacyPool.filters.Deposit()
    );
    const commitments = depositEvents.map((event) => event.args.commitment);
    const tree = new CircuitCompatibleMerkleTree(20, commitments);
    await tree.initialize();

    // 3. Generate the Merkle path
    const leafIndex = commitments.findIndex((c) => c === commitment);
    const proof = tree.generateProof(leafIndex);

    // 4. Prepare inputs for the circuit
    const { nullifier } = parseNote(note);
    const nullifierHash = await generateNullifierHash(secret);
    
    // 4. Prepare inputs for the circuit - 使用与前端完全一致的BigInt格式
    const input = {
      secret: BigInt(secret),
      nullifier: BigInt(nullifierHash),
      amount: BigInt(ethers.parseEther("0.1").toString()),
      pathElements: proof.pathElements.map(el => BigInt(el)),
      pathIndices: proof.pathIndices,
      merkleRoot: BigInt(tree.getRoot()),
    };

    // 5. Generate the proof
    try {
      const wasmPath = path.join(process.cwd(), "frontend", "public", "zk", "withdraw.wasm");
      const zkeyPath = path.join(process.cwd(), "frontend", "public", "zk", "withdraw.zkey");

      const wasmBytes = fs.readFileSync(wasmPath);
      const zkeyBytes = fs.readFileSync(zkeyPath);

      const { proof, publicSignals } = await groth16.fullProve(
        input,
        wasmBytes,
        zkeyBytes
      );
      // If we reach here, the proof generation was successful.
      expect(proof).to.not.be.null;
      expect(publicSignals).to.not.be.null;
    } catch (error) {
      // This will catch any errors from snarkjs and fail the test.
      // We are logging the inputs here to make debugging easier if the test fails.
      console.error("ZK Proof Generation Failed. Inputs:", input);
      throw error;
    }
  });
});
