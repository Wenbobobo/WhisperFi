import { expect } from "chai";
import { ethers } from "hardhat";
import { PrivacyPool, PoseidonHasher } from "../typechain-types";
// @ts-ignore
import * as circomlibjs from "circomlibjs";

describe("Hash Consistency Test", function () {
  let privacyPool: PrivacyPool;
  let poseidonHasher: PoseidonHasher;
  let poseidon: any;

  before(async function () {
    // Initialize circomlibjs poseidon
    poseidon = await circomlibjs.buildPoseidon();

    // Deploy contracts
    const PoseidonHasherFactory = await ethers.getContractFactory(
      "PoseidonHasher"
    );
    poseidonHasher = await PoseidonHasherFactory.deploy();
    await poseidonHasher.waitForDeployment();

    const [owner] = await ethers.getSigners();
    const PrivacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
    privacyPool = await PrivacyPoolFactory.deploy(
      "0x0000000000000000000000000000000000000000", // Mock verifier for this test
      await poseidonHasher.getAddress(),
      await owner.getAddress()
    );
    await privacyPool.waitForDeployment();
  });

  it("should have consistent hash calculations between frontend and backend", async function () {
    // Test data - using fixed values for consistency
    const secret =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const amount = ethers.parseEther("0.1"); // 0.1 ETH

    // Frontend hash calculation (using circomlibjs)
    const frontendHash = poseidon([BigInt(secret), BigInt(amount.toString())]);
    // Convert the poseidon field element to hex string format expected by ethers
    const frontendHashHex = "0x" + poseidon.F.toObject(frontendHash).toString(16).padStart(64, "0");

    // Backend hash calculation (calling contract)
    const backendHash = await poseidonHasher.calculateCommitment(
      secret,
      amount
    );
    const backendHashHex = ethers.toBeHex(backendHash, 32);

    // Assert equality
    expect(frontendHashHex).to.equal(
      backendHashHex,
      "Frontend and backend hashes should match"
    );
  });

  it("should have consistent nullifier hash calculations", async function () {
    // Test nullifier hash calculation
    const secret =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    // Frontend nullifier hash calculation (using circomlibjs)
    const frontendNullifierHash = poseidon([BigInt(secret)]);
    // Convert the poseidon field element to hex string format expected by ethers
    const frontendNullifierHashHex = "0x" + poseidon.F.toObject(frontendNullifierHash).toString(16).padStart(64, "0");

    // Backend nullifier hash calculation (calling contract directly)
    const backendNullifierHash = await poseidonHasher.calculateCommitment(
      secret,
      0
    ); // Using 0 for nullifier hash
    const backendNullifierHashHex = ethers.toBeHex(backendNullifierHash, 32);

    // Assert equality
    expect(frontendNullifierHashHex).to.equal(
      backendNullifierHashHex,
      "Frontend and backend nullifier hashes should match"
    );
  });
});
