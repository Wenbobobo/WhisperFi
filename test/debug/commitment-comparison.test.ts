// test/debug/commitment-comparison.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";

describe("Commitment Generation Comparison", function () {
  let poseidon: any;

  before(async function () {
    poseidon = await buildPoseidon();
  });

  // Backend implementation (from our test)
  function hexToBigInt(hex: string): bigint {
    return BigInt(hex);
  }

  function poseidonHash(inputs: bigint[]): string {
    const hash = poseidon(inputs);
    return '0x' + poseidon.F.toObject(hash).toString(16).padStart(64, '0');
  }

  function generateCommitmentBackend(secret: string, nullifier: string): string {
    const secretBigInt = hexToBigInt(secret);
    const nullifierBigInt = hexToBigInt(nullifier);
    return poseidonHash([secretBigInt, nullifierBigInt]);
  }

  // Frontend implementation (simulated)
  async function generateCommitmentFrontend(secret: string, nullifier: string): Promise<string> {
    const secretBigInt = hexToBigInt(secret);
    const nullifierBigInt = hexToBigInt(nullifier);
    return poseidonHash([secretBigInt, nullifierBigInt]);
  }

  it("should generate the same commitment in frontend and backend", async function () {
    const secretNote = "my-secret-note-123";
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secretNote));
    const nullifier = ethers.keccak256(ethers.toUtf8Bytes(`nullifier-${secretNote}`));

    console.log("Input values:");
    console.log("  Secret note:", secretNote);
    console.log("  Secret hash:", secretHash);
    console.log("  Nullifier:", nullifier);

    // Generate commitments using both methods
    const backendCommitment = generateCommitmentBackend(secretHash, nullifier);
    const frontendCommitment = await generateCommitmentFrontend(secretHash, nullifier);

    console.log("Generated commitments:");
    console.log("  Backend:", backendCommitment);
    console.log("  Frontend:", frontendCommitment);

    expect(backendCommitment).to.equal(frontendCommitment);
  });

  it("should show hex to BigInt conversion", async function () {
    const testHex = "0x71b8bc40f3e13b65e3ba7a1165b358b1cf02b3265ed4dab725ab71e6546228c8";
    const bigIntValue = hexToBigInt(testHex);
    
    console.log("Hex to BigInt conversion:");
    console.log("  Input:", testHex);
    console.log("  BigInt:", bigIntValue.toString());
    console.log("  Back to hex:", "0x" + bigIntValue.toString(16));
  });

  it("should compare with known working values from backend test", async function () {
    // Use the exact values from our successful backend test
    const secretHash = "0x71b8bc40f3e13b65e3ba7a1165b358b1cf02b3265ed4dab725ab71e6546228c8";
    const nullifier = "0x4c5f933a04dfd32fbf93a94d42d8ec39238014c2a2c6945c28424acdf65bb03d";
    const expectedCommitment = "0x016d5c95a67cc168296c62af663c55bb08095c3323776f234f21948f05cea387";

    const generatedCommitment = generateCommitmentBackend(secretHash, nullifier);
    
    console.log("Known working test:");
    console.log("  Expected:", expectedCommitment);
    console.log("  Generated:", generatedCommitment);
    
    expect(generatedCommitment).to.equal(expectedCommitment);
  });
});
