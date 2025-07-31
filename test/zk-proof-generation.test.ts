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

  it("should generate a valid proof for a simple withdrawal", async function () {
    // 1. Create a note and deposit
    const note = generateNote();
    const { secret } = parseNote(note);
    // Note: In the simplified circuit, commitment is just hash of secret.
    const commitment = poseidon([BigInt(secret)]);
    
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
    const merkleProof = tree.generateProof(leafIndex);

    // 4. Prepare inputs for the circuit
    const { nullifier } = parseNote(note);
    const nullifierHash = await generateNullifierHash(secret);

    const input = {
      secret: BigInt(secret),
      nullifier: BigInt(nullifierHash),
      merkleRoot: BigInt(tree.getRoot()),
      pathElements: merkleProof.pathElements.map(el => BigInt(el)),
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
