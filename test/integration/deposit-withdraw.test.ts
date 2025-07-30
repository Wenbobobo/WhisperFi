// test/integration/deposit-withdraw.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { buildPoseidon } from "circomlibjs";
import { Groth16Verifier, PrivacyPool, Executor } from "../../typechain-types";
import { deployPoseidon } from "../../scripts/deploy-poseidon";
import { deployPoseidon5 } from "../../scripts/deploy-poseidon5";

describe("Deposit-Withdraw Integration Test", function () {
  let owner: Signer;
  let verifier: Groth16Verifier;
  let privacyPool: PrivacyPool;
  let executor: Executor;
  let poseidon: any;

  before(async function () {
    // Initialize Poseidon
    poseidon = await buildPoseidon();
  });

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Pre-fetch addresses to avoid ENS resolution issues
    const ownerAddress = await owner.getAddress();

    // Deploy the actual Groth16Verifier contract (production verifier)
    const Groth16VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await Groth16VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();

    // Deploy PoseidonHasher using the official deployment script
    const poseidonDeployment = await deployPoseidon();
    const poseidonHasherAddress = poseidonDeployment.address;

    // Deploy the 5-input Poseidon hasher as well
    const poseidon5Deployment = await deployPoseidon5();
    const poseidon5HasherAddress = poseidon5Deployment.address;

    const ExecutorFactory = await ethers.getContractFactory("Executor");
    executor = await ExecutorFactory.deploy(ownerAddress);
    await executor.waitForDeployment();

    // Deploy PrivacyPool with correct constructor parameters
    const PrivacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
    privacyPool = await PrivacyPoolFactory.deploy(
      verifierAddress,        // _verifier
      poseidonHasherAddress,  // _poseidonHasher
      poseidon5HasherAddress, // _poseidonHasher5
      ownerAddress            // _initialOwner
    );
    await privacyPool.waitForDeployment();
  });

  // Helper functions matching ZK circuit design
  function hexToBigInt(hex: string): bigint {
    return BigInt(hex);
  }

  function poseidonHash(inputs: bigint[]): string {
    const hash = poseidon(inputs);
    return "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
  }

  // Updated to match ZK circuit: commitment = poseidon([secret, amount])
  function generateCommitment(secret: string, amount: bigint): string {
    const secretBigInt = hexToBigInt(secret);
    return poseidonHash([secretBigInt, amount]);
  }

  // Updated to match ZK circuit: nullifierHash = poseidon([secret])
  function generateNullifierHash(secret: string): string {
    const secretBigInt = hexToBigInt(secret);
    return poseidonHash([secretBigInt]);
  }

  describe("Complete Deposit-Withdraw Flow", function () {
    it("should allow deposit and then find the commitment for withdrawal", async function () {
      // Step 1: Simulate frontend commitment generation with correct ZK circuit logic
      const secretNote = "my-secret-note-123";
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secretNote));
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      // Use ZK circuit compatible commitment calculation: poseidon([secret, amount])
      const commitment = generateCommitment(secretHash, depositAmount);

      // Step 2: Make deposit
      const tx = await privacyPool.deposit(commitment, {
        value: depositAmount,
      });
      await tx.wait();

      // Step 3: Get deposit events
      const depositEvents = await privacyPool.queryFilter(
        privacyPool.filters.Deposit(commitment)
      );

      expect(depositEvents.length).to.equal(1);
      expect((depositEvents[0] as any).args.commitment).to.equal(commitment);

      // Step 4: Simulate withdrawal commitment lookup
      const allDepositEvents = await privacyPool.queryFilter(
        privacyPool.filters.Deposit()
      );

      const commitments = allDepositEvents.map(
        (event) => (event as any).args.commitment
      );
      const foundIndex = commitments.findIndex((c) => c === commitment);

      expect(foundIndex).to.be.greaterThan(-1);

      // Step 5: Verify nullifier hash generation (ZK circuit compatible)
      const nullifierHash = generateNullifierHash(secretHash);

      expect(nullifierHash).to.match(/^0x[0-9a-fA-F]{64}$/);
    });

    it("should generate different commitments for different secrets with same amount", async function () {
      const secret1 = "secret-1";
      const secret2 = "secret-2";
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const secretHash1 = ethers.keccak256(ethers.toUtf8Bytes(secret1));
      const commitment1 = generateCommitment(secretHash1, depositAmount);

      const secretHash2 = ethers.keccak256(ethers.toUtf8Bytes(secret2));
      const commitment2 = generateCommitment(secretHash2, depositAmount);

      expect(commitment1).to.not.equal(commitment2);
    });

    it("should generate different commitments for same secret with different amounts", async function () {
      const secret = "same-secret";
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));

      const amount1 = ethers.parseEther("0.1");
      const amount2 = ethers.parseEther("0.2");

      const commitment1 = generateCommitment(secretHash, amount1);
      const commitment2 = generateCommitment(secretHash, amount2);

      expect(commitment1).to.not.equal(commitment2);
    });
  });
});
