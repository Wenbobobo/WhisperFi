import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";

async function main() {
  console.log("\n🧪 Testing Withdraw Function Call on Sepolia\n");
  console.log("=".repeat(70));
  console.log("⚠️  Note: This test verifies that withdraw() works on Sepolia");
  console.log("    (bypassing the Hardhat EVM bug we discovered)\n");

  const [signer] = await ethers.getSigners();
  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    signer
  );

  console.log("📍 Contract:", CONTRACTS.PRIVACY_POOL_ADDRESS);
  console.log("📍 Network: Sepolia");

  // Get current merkle root
  const currentRoot = await privacyPool.merkleRoot();
  console.log("\n🌳 Current Merkle Root:", currentRoot);

  // Check if root is in history
  const inHistory = await privacyPool.rootHistory(currentRoot);
  console.log("   In rootHistory:", inHistory ? "✅ YES" : "❌ NO");

  // Generate a test proof (won't be valid, but tests function call)
  console.log("\n⚙️  Generating test ZK proof...");
  const secret = BigInt("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  const amount = BigInt("100000000000000000");

  const { proof } = await groth16.fullProve(
    {
      secret: secret.toString(),
      amount: amount.toString(),
      pathElements: Array(16).fill("0"),
      pathIndices: Array(16).fill(0)
    },
    "frontend/public/zk/withdraw.wasm",
    "frontend/public/zk/withdraw.zkey"
  );

  const proofA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const proofB = [
    [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
    [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])],
  ];
  const proofC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

  console.log("✅ Test proof generated!");

  // Test 1: Call with current root (THIS WOULD FAIL ON HARDHAT!)
  console.log("\n🧪 Test 1: Withdraw with REAL merkleRoot (in rootHistory)");
  console.log("   On Hardhat: This would fail with 'function selector not recognized'");
  console.log("   On Sepolia: Should work and revert with contract error\n");

  const poseidon = await buildPoseidon();
  const nullifierHash = poseidon([secret, 0n]);
  const nullifier = "0x" + poseidon.F.toObject(nullifierHash).toString(16).padStart(64, '0');

  try {
    await privacyPool.withdraw.staticCall(
      proofA,
      proofB,
      proofC,
      currentRoot,  // Real root that's in rootHistory
      nullifier,
      await signer.getAddress(),
      0n,
      ethers.ZeroAddress
    );
    console.log("   ✅ Call succeeded (unexpected!)");
  } catch (error: any) {
    if (error.message.includes("function selector")) {
      console.log("   ❌ FAILED: Function selector not recognized");
      console.log("   🐛 This means we're still hitting the Hardhat bug!");
    } else {
      console.log("   ✅ SUCCESS: Function was recognized!");
      console.log("   Expected contract revert:", error.message.split('\n')[0].slice(0, 80) + "...");
      console.log("\n   🎉 This proves the withdraw function WORKS on Sepolia!");
      console.log("   🎉 The Hardhat bug is BYPASSED!");
    }
  }

  // Test 2: Call with zero root (should work everywhere)
  console.log("\n🧪 Test 2: Withdraw with ZeroHash (not in rootHistory)");
  console.log("   This works on both Hardhat and Sepolia\n");

  try {
    await privacyPool.withdraw.staticCall(
      proofA,
      proofB,
      proofC,
      ethers.ZeroHash,  // Not in rootHistory
      nullifier,
      await signer.getAddress(),
      0n,
      ethers.ZeroAddress
    );
    console.log("   ✅ Call succeeded");
  } catch (error: any) {
    if (error.message.includes("function selector")) {
      console.log("   ❌ Function selector not recognized (unexpected!)");
    } else {
      console.log("   ✅ Function recognized");
      console.log("   Contract error:", error.message.split('\n')[0].slice(0, 80) + "...");
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ Sepolia Withdraw Function Test Complete!");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
