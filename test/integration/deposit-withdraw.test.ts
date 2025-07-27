// test/integration/deposit-withdraw.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { buildPoseidon } from "circomlibjs";

describe("Deposit-Withdraw Integration Test", function () {
  let owner: Signer;
  let verifier: Contract;
  let privacyPool: Contract;
  let executor: Contract;
  let poseidon: any;

  before(async function () {
    // Initialize Poseidon
    poseidon = await buildPoseidon();
  });

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy the actual Verifier contract
    const Verifier = await ethers.getContractFactory("Verifier");
    verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    const Executor = await ethers.getContractFactory("Executor");
    executor = await Executor.deploy(await owner.getAddress());
    await executor.waitForDeployment();

    const initialRoot = ethers.encodeBytes32String("initialRoot");
    const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
    privacyPool = await PrivacyPool.deploy(
      await verifier.getAddress(),
      initialRoot,
      await owner.getAddress()
    );
    await privacyPool.waitForDeployment();
  });

  // Helper functions matching ZK circuit design
  function hexToBigInt(hex: string): bigint {
    return BigInt(hex);
  }

  function poseidonHash(inputs: bigint[]): string {
    const hash = poseidon(inputs);
    return '0x' + poseidon.F.toObject(hash).toString(16).padStart(64, '0');
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

      console.log("Secret note:", secretNote);
      console.log("Secret hash:", secretHash);
      console.log("Deposit amount:", depositAmount.toString());
      console.log("Generated commitment:", commitment);

      // Step 2: Make deposit
      const tx = await privacyPool.deposit(commitment, { value: depositAmount });
      await tx.wait();

      // Step 3: Get deposit events
      const depositEvents = await privacyPool.queryFilter(
        privacyPool.filters.Deposit(commitment)
      );

      expect(depositEvents.length).to.equal(1);
      expect(depositEvents[0].args.commitment).to.equal(commitment);

      // Step 4: Simulate withdrawal commitment lookup
      const allDepositEvents = await privacyPool.queryFilter(
        privacyPool.filters.Deposit()
      );
      
      const commitments = allDepositEvents.map(event => event.args.commitment);
      console.log("All commitments:", commitments);
      
      const foundIndex = commitments.findIndex(c => c === commitment);
      console.log("Found commitment at index:", foundIndex);
      
      expect(foundIndex).to.be.greaterThan(-1);
      
      // Step 5: Verify nullifier hash generation (ZK circuit compatible)
      const nullifierHash = generateNullifierHash(secretHash);
      console.log("Generated nullifier hash:", nullifierHash);
      
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
      console.log("Commitment 1:", commitment1);
      console.log("Commitment 2:", commitment2);
    });

    it("should generate different commitments for same secret with different amounts", async function () {
      const secret = "same-secret";
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
      
      const amount1 = ethers.parseEther("0.1");
      const amount2 = ethers.parseEther("0.2");
      
      const commitment1 = generateCommitment(secretHash, amount1);
      const commitment2 = generateCommitment(secretHash, amount2);
      
      expect(commitment1).to.not.equal(commitment2);
      console.log("Commitment with amount1:", commitment1);
      console.log("Commitment with amount2:", commitment2);
    });
  });
});
