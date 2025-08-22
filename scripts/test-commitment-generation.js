// scripts/test-commitment-generation.js
const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

// 模拟前端的generateCommitment函数
async function generateCommitment(secret, amount) {
  const poseidon = await buildPoseidon();
  // Ensure inputs are converted to BigInt, which is expected by circomlibjs
  // Remove "0x" prefix if present before converting to BigInt
  const secretValue = secret.startsWith("0x") ? secret : "0x" + secret;
  const hash = poseidon([BigInt(secretValue), BigInt(amount)]);
  // Convert the poseidon field element to hex string format expected by ethers
  return "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
}

// 模拟前端的parseNote函数
function parseNote(note) {
  const parts = note.split("-");
  if (parts.length !== 5 || parts[0] !== "private" || parts[1] !== "defi") {
    throw new Error(
      "Invalid note format. Expected format: private-defi-<secret>-<nullifier>-v1"
    );
  }
  return {
    secret: "0x" + parts[2],
    nullifier: "0x" + parts[3],
  };
}

// 模拟前端的generateNote函数
function generateNote() {
  const secret = ethers.hexlify(ethers.randomBytes(31));
  const nullifier = ethers.hexlify(ethers.randomBytes(31));
  return `private-defi-${secret.slice(2)}-${nullifier.slice(2)}-v1`;
}

async function main() {
  console.log("🔍 Testing commitment generation with fixed implementation...");
  
  // Test case 1: Using a real note
  const note = generateNote();
  console.log("\n=== Test Case 1: Real note ===");
  console.log("Note:", note);
  
  const { secret, nullifier } = parseNote(note);
  console.log("Parsed secret:", secret);
  console.log("Parsed nullifier:", nullifier);
  
  const amount = ethers.parseEther("0.1").toString();
  console.log("Amount:", amount);
  
  try {
    const commitment = await generateCommitment(secret, amount);
    console.log("Generated commitment:", commitment);
    console.log("✅ Commitment generation successful");
  } catch (error) {
    console.error("❌ Commitment generation failed:", error.message);
    return;
  }
  
  // Test case 2: Using known values
  console.log("\n=== Test Case 2: Known values ===");
  const secret2 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const amount2 = ethers.parseEther("0.1").toString();
  
  console.log("Secret:", secret2);
  console.log("Amount:", amount2);
  
  try {
    const commitment2 = await generateCommitment(secret2, amount2);
    console.log("Generated commitment:", commitment2);
    console.log("✅ Commitment generation successful");
  } catch (error) {
    console.error("❌ Commitment generation failed:", error.message);
    return;
  }
  
  console.log("\n✅ All tests completed successfully");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });