import { expect } from "chai";
import { ethers } from "hardhat";
import { PrivacyPool, PoseidonHasher } from "../typechain-types";
import * as circomlibjs from "circomlibjs";

describe("Hash Consistency Test", function () {
  let privacyPool: PrivacyPool;
  let poseidonHasher: PoseidonHasher;
  let poseidon: any;

  before(async function () {
    // Initialize circomlibjs poseidon
    poseidon = await circomlibjs.buildPoseidon();
    
    // Deploy contracts
    const PoseidonHasherFactory = await ethers.getContractFactory("PoseidonHasher");
    poseidonHasher = await PoseidonHasherFactory.deploy();
    await poseidonHasher.waitForDeployment();

    const PrivacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
    privacyPool = await PrivacyPoolFactory.deploy(
      await poseidonHasher.getAddress(),
      "0x0000000000000000000000000000000000000000" // Mock verifier for this test
    );
    await privacyPool.waitForDeployment();
  });

  it("should have consistent hash calculations between frontend and backend", async function () {
    // Test data - using fixed values for consistency
    const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const amount = ethers.parseEther("0.1"); // 0.1 ETH
    
    console.log("Testing with:");
    console.log("Secret:", secret);
    console.log("Amount:", amount.toString());

    // Frontend hash calculation (using circomlibjs)
    const frontendHash = poseidon([BigInt(secret), BigInt(amount.toString())]);
    const frontendHashHex = ethers.toBeHex(frontendHash, 32);
    
    console.log("Frontend hash (BigInt):", frontendHash.toString());
    console.log("Frontend hash (hex):", frontendHashHex);

    // Backend hash calculation (calling contract)
    const backendHash = await poseidonHasher.calculateCommitment(secret, amount);
    const backendHashHex = ethers.toBeHex(backendHash, 32);
    
    console.log("Backend hash (BigInt):", backendHash.toString());
    console.log("Backend hash (hex):", backendHashHex);

    // Direct contract poseidon call
    const directContractHash = await poseidonHasher.poseidon([BigInt(secret), BigInt(amount.toString())]);
    console.log("Direct contract poseidon hash:", ethers.toBeHex(directContractHash, 32));

    // Compare hashes
    console.log("Hashes are equal:", frontendHashHex === backendHashHex);
    
    // Assert equality
    expect(frontendHashHex).to.equal(backendHashHex, "Frontend and backend hashes should match");
  });

  it("should have consistent nullifier hash calculations", async function () {
    // Test nullifier hash calculation
    const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    
    console.log("Testing nullifier hash with secret:", secret);

    // Frontend nullifier hash calculation (using circomlibjs)
    const frontendNullifierHash = poseidon([BigInt(secret)]);
    const frontendNullifierHashHex = ethers.toBeHex(frontendNullifierHash, 32);
    
    console.log("Frontend nullifier hash (BigInt):", frontendNullifierHash.toString());
    console.log("Frontend nullifier hash (hex):", frontendNullifierHashHex);

    // Backend nullifier hash calculation (calling contract directly)
    const backendNullifierHash = await poseidonHasher.poseidon([BigInt(secret)]);
    const backendNullifierHashHex = ethers.toBeHex(backendNullifierHash, 32);
    
    console.log("Backend nullifier hash (BigInt):", backendNullifierHash.toString());
    console.log("Backend nullifier hash (hex):", backendNullifierHashHex);

    // Compare hashes
    console.log("Nullifier hashes are equal:", frontendNullifierHashHex === backendNullifierHashHex);
    
    // Assert equality
    expect(frontendNullifierHashHex).to.equal(backendNullifierHashHex, "Frontend and backend nullifier hashes should match");
  });
});