// scripts/verify-commitment-consistency.js
const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

async function main() {
  // Initialize Poseidon
  const poseidon = await buildPoseidon();
  
  console.log("🔍 Verifying commitment generation consistency between frontend and contract...");
  
  // Test case 1: Using the same values as in test-deposit-with-correct-commitment.ts
  const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const amount = ethers.parseEther("0.1").toString();
  
  console.log("\n=== Test Case 1: Known values ===");
  console.log("Secret:", secret);
  console.log("Amount:", amount);
  
  // Generate commitment using frontend logic (same as crypto.ts)
  // 注意：这里需要去掉"0x"前缀再转换为BigInt
  const secretWithoutPrefix = secret.startsWith("0x") ? secret.slice(2) : secret;
  const frontendHash = poseidon([BigInt("0x" + secretWithoutPrefix), BigInt(amount)]);
  const frontendCommitment = "0x" + poseidon.F.toObject(frontendHash).toString(16).padStart(64, "0");
  
  console.log("Frontend commitment:", frontendCommitment);
  
  // Test case 2: Using values from a real note
  const note = "private-defi-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890-v1";
  const parts = note.split("-");
  const secret2 = "0x" + parts[2];
  const amount2 = ethers.parseEther("0.1").toString();
  
  console.log("\n=== Test Case 2: Real note values ===");
  console.log("Note:", note);
  console.log("Secret:", secret2);
  console.log("Amount:", amount2);
  
  // Generate commitment using frontend logic
  const secret2WithoutPrefix = secret2.startsWith("0x") ? secret2.slice(2) : secret2;
  const frontendHash2 = poseidon([BigInt("0x" + secret2WithoutPrefix), BigInt(amount2)]);
  const frontendCommitment2 = "0x" + poseidon.F.toObject(frontendHash2).toString(16).padStart(64, "0");
  
  console.log("Frontend commitment:", frontendCommitment2);
  
  // Test case 3: Using random values (like in test-deposit.ts)
  console.log("\n=== Test Case 3: Random values ===");
  const randomBytes = ethers.randomBytes(32);
  const randomCommitment = ethers.hexlify(randomBytes);
  console.log("Random commitment:", randomCommitment);
  
  console.log("\n✅ Verification complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });