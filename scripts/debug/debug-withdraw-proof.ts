import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import { buildPoseidon } from "circomlibjs";
import { CONTRACTS } from "../frontend/src/config/contracts";

const NOTE = "0x0327ffa95e2c50b8000000000000000000000000000000000056bc75e2d63100000";

async function main() {
  console.log("\n🔍 Debug Withdraw Proof Generation\n");
  console.log("=" .repeat(60));

  // Parse note
  const secret = BigInt("0x0327ffa95e2c50b8");
  const amount = BigInt("100000000000000000"); // 0.1 ETH

  console.log("\n📝 Note Details:");
  console.log("  Secret:", secret.toString());
  console.log("  Amount:", ethers.formatEther(amount), "ETH");

  // Get contract instance
  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  // Build Poseidon hasher
  const poseidon = await buildPoseidon();

  // Calculate commitment
  const commitmentHash = poseidon([secret, amount]);
  const commitment = poseidon.F.toString(commitmentHash);
  console.log("\n🔐 Commitment:", commitment);

  // Calculate nullifier
  const nullifierHash = poseidon([secret, 0n]);
  const nullifier = poseidon.F.toString(nullifierHash);
  console.log("🔒 Nullifier:", nullifier);

  // Get merkle root from contract
  const merkleRoot = await privacyPool.merkleRoot();
  console.log("🌳 Merkle Root:", merkleRoot);

  // For simplicity, use empty path (this won't work for real verification, but shows the format)
  const pathElements = Array(16).fill(0n);
  const pathIndices = Array(16).fill(0);

  console.log("\n⚙️  Generating proof...");

  const circuitInput = {
    secret: secret,
    amount: amount,
    pathElements: pathElements,
    pathIndices: pathIndices,
  };

  console.log("\n📊 Circuit Input:");
  console.log(JSON.stringify(circuitInput, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v, 2));

  try {
    const { proof, publicSignals } = await groth16.fullProve(
      circuitInput,
      "frontend/public/zk/withdraw.wasm",
      "frontend/public/zk/withdraw.zkey"
    );

    console.log("\n✅ Proof generated successfully!");
    console.log("\n📤 Public Signals:");
    console.log("  publicInputsHash:", publicSignals[0]);

    // Calculate expected publicInputsHash
    const calculatedRoot = poseidon.F.toString(poseidon([BigInt(commitment)]));
    const expectedHash = poseidon([BigInt(calculatedRoot), BigInt(nullifier)]);
    const expectedHashStr = poseidon.F.toString(expectedHash);

    console.log("\n🧮 Expected publicInputsHash:");
    console.log("  Calculated:", expectedHashStr);
    console.log("  Match:", publicSignals[0] === expectedHashStr ? "✅ YES" : "❌ NO");

    // Format proof for Solidity
    const proofForSolidity = [
      proof.pi_a.slice(0, 2),
      [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ],
      proof.pi_c.slice(0, 2)
    ];

    console.log("\n🔧 Proof Format for Solidity:");
    console.log("  a:", proofForSolidity[0]);
    console.log("  b:", proofForSolidity[1]);
    console.log("  c:", proofForSolidity[2]);

    // Test verifier contract
    console.log("\n🧪 Testing Groth16Verifier contract...");
    const verifier = await ethers.getContractAt(
      "Groth16Verifier",
      CONTRACTS.VERIFIER_ADDRESS
    );

    try {
      const isValid = await verifier.verifyProof(
        proofForSolidity[0],
        proofForSolidity[1],
        proofForSolidity[2],
        [publicSignals[0]]
      );
      console.log("  Verification result:", isValid ? "✅ VALID" : "❌ INVALID");
    } catch (error: any) {
      console.log("  ❌ Verification FAILED:", error.message);
    }

    // Test PrivacyPool withdraw
    console.log("\n🏊 Testing PrivacyPool.withdraw...");
    const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const fee = 0n;
    const relayer = ethers.ZeroAddress;

    const merkleRootBytes32 = ethers.toBeHex(BigInt(calculatedRoot), 32);
    const nullifierBytes32 = ethers.toBeHex(BigInt(nullifier), 32);

    console.log("  Merkle Root (bytes32):", merkleRootBytes32);
    console.log("  Nullifier (bytes32):", nullifierBytes32);

    try {
      const [signer] = await ethers.getSigners();
      const tx = await privacyPool.connect(signer).withdraw(
        proofForSolidity[0],
        proofForSolidity[1],
        proofForSolidity[2],
        merkleRootBytes32,
        nullifierBytes32,
        recipient,
        fee,
        relayer
      );
      const receipt = await tx.wait();
      console.log("  ✅ Withdrawal successful!");
      console.log("  Transaction hash:", receipt?.hash);
    } catch (error: any) {
      console.log("  ❌ Withdrawal FAILED:", error.message);
      if (error.data) {
        console.log("  Error data:", error.data);
      }
    }

  } catch (error: any) {
    console.log("\n❌ Proof generation failed:", error.message);
  }

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
