import { expect } from "chai";
import { ethers } from "hardhat";
import { PrivacyPool } from "../typechain-types";
import { deployPoseidon } from "../scripts/deploy-poseidon";
import { deployPoseidon5 } from "../scripts/deploy-poseidon5";
// @ts-ignore
import * as circomlibjs from "circomlibjs";

describe("Hash Consistency Test", function () {
  let privacyPool: PrivacyPool;
  let poseidonHasher: any;
  let poseidon: any;

  before(async function () {
    // Initialize circomlibjs poseidon
    poseidon = await circomlibjs.buildPoseidon();

    // Deploy official Poseidon hasher using deployPoseidon function
    console.log("🔧 Deploying official Poseidon hasher for testing...");
    const poseidonResult = await deployPoseidon();
    poseidonHasher = poseidonResult.contract;
    console.log("✅ Official Poseidon hasher deployed at:", poseidonResult.address);

    // Also deploy the 5-input hasher
    const poseidon5Result = await deployPoseidon5();

    const [owner] = await ethers.getSigners();
    const PrivacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
    privacyPool = await PrivacyPoolFactory.deploy(
      "0x0000000000000000000000000000000000000000", // Mock verifier for this test
      poseidonResult.address,
      poseidon5Result.address,
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

    // Backend hash calculation (calling official Poseidon contract)
    const backendHash = await poseidonHasher["poseidon(uint256[2])"]([BigInt(secret), BigInt(amount.toString())]);
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
    // Use zero padding to match the backend contract's poseidon(uint256[2]) signature
    const frontendNullifierHash = poseidon([BigInt(secret), 0n]);
    // Convert the poseidon field element to hex string format expected by ethers
    const frontendNullifierHashHex = "0x" + poseidon.F.toObject(frontendNullifierHash).toString(16).padStart(64, "0");

    // Backend nullifier hash calculation (calling official Poseidon contract)
    // For single input, we add a 0 as the second input to match circomlibjs behavior
    const backendNullifierHash = await poseidonHasher["poseidon(uint256[2])"]([BigInt(secret), 0n]);
    const backendNullifierHashHex = ethers.toBeHex(backendNullifierHash, 32);

    // Assert equality
    expect(frontendNullifierHashHex).to.equal(
      backendNullifierHashHex,
      "Frontend and backend nullifier hashes should match"
    );
  });
});
