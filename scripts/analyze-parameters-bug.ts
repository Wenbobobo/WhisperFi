import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function testWithdrawCall(
  name: string,
  proofA: bigint[],
  proofB: bigint[][],
  proofC: bigint[],
  merkleRoot: string,
  nullifier: string,
  recipient: string,
  fee: bigint,
  relayer: string
) {
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    await ethers.provider.getSigner(0)
  );

  console.log(`\n🧪 Test: ${name}`);
  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  Nullifier: ${nullifier}`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Fee: ${fee}`);
  console.log(`  Relayer: ${relayer}`);

  try {
    await privacyPool.withdraw.staticCall(
      proofA,
      proofB,
      proofC,
      merkleRoot,
      nullifier,
      recipient,
      fee,
      relayer
    );
    console.log(`  ✅ Function recognized, call succeeded`);
    return true;
  } catch (error: any) {
    if (error.message.includes("function selector")) {
      console.log(`  ❌ Function selector NOT recognized`);
      console.log(`  Error: ${error.message.split('\n')[0]}`);
      return false;
    } else {
      console.log(`  ✅ Function recognized`);
      console.log(`  Contract error: ${error.message.split('\n')[0].slice(0, 80)}...`);
      return true;
    }
  }
}

async function main() {
  console.log("\n🔬 Analyzing Parameter Bug\n");
  console.log("=".repeat(70));

  // Generate a simple proof
  const secret = BigInt("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  const amount = BigInt("100000000000000000");

  console.log("⚙️  Generating test proof...");
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
  console.log("✅ Proof generated!");

  // Get real merkle root from contract
  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );
  const contractRoot = await privacyPool.merkleRoot();
  console.log("\n📊 Contract state:");
  console.log(`  Current Merkle Root: ${contractRoot}`);

  // Test different parameter combinations
  const poseidon = await buildPoseidon();
  const nullifierHash = poseidon([secret, 0n]);
  const realNullifier = "0x" + poseidon.F.toObject(nullifierHash).toString(16).padStart(64, '0');

  // Test 1: All zeros
  await testWithdrawCall(
    "All zero parameters",
    proofA, proofB, proofC,
    ethers.ZeroHash,
    ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  );

  // Test 2: Real merkle root, zero nullifier
  await testWithdrawCall(
    "Real merkle root, zero nullifier",
    proofA, proofB, proofC,
    contractRoot,
    ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  );

  // Test 3: Zero merkle root, real nullifier
  await testWithdrawCall(
    "Zero merkle root, real nullifier",
    proofA, proofB, proofC,
    ethers.ZeroHash,
    realNullifier,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  );

  // Test 4: Real merkle root AND real nullifier
  await testWithdrawCall(
    "Real merkle root AND real nullifier",
    proofA, proofB, proofC,
    contractRoot,
    realNullifier,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  );

  // Test 5: Try with fee
  await testWithdrawCall(
    "With non-zero fee",
    proofA, proofB, proofC,
    contractRoot,
    realNullifier,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    ethers.parseEther("0.01"),
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  );

  // Test 6: Different recipient address
  await testWithdrawCall(
    "Different recipient",
    proofA, proofB, proofC,
    contractRoot,
    realNullifier,
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    0n,
    ethers.ZeroAddress
  );

  // Test 7: Use the EXACT parameters from the failing test
  console.log("\n🎯 Recreating EXACT failing scenario:");

  const playwriteSecret = BigInt("0x8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91");
  const playwriteAmount = BigInt("100000000000000000");

  const playwriteNullifierHash = poseidon([playwriteSecret, 0n]);
  const playwriteNullifier = "0x" + poseidon.F.toObject(playwriteNullifierHash).toString(16).padStart(64, '0');

  console.log("  Using PLAYWRIGHT secret nullifier:", playwriteNullifier);
  console.log("  Expected: 0x24a3b855d0a89ad666e353ca484cac657c15f27b444cbbbd55d72db12bd7825f");
  console.log("  Match:", playwriteNullifier === "0x24a3b855d0a89ad666e353ca484cac657c15f27b444cbbbd55d72db12bd7825f" ? "✅" : "❌");

  // Generate proof with PLAYWRIGHT secret
  console.log("\n  Generating proof with PLAYWRIGHT secret...");
  const { proof: playwriteProof } = await groth16.fullProve(
    {
      secret: playwriteSecret.toString(),
      amount: playwriteAmount.toString(),
      pathElements: Array(16).fill("0"),
      pathIndices: Array(16).fill(0)
    },
    "frontend/public/zk/withdraw.wasm",
    "frontend/public/zk/withdraw.zkey"
  );

  const playwriteProofA = [BigInt(playwriteProof.pi_a[0]), BigInt(playwriteProof.pi_a[1])];
  const playwriteProofB = [
    [BigInt(playwriteProof.pi_b[0][0]), BigInt(playwriteProof.pi_b[0][1])],
    [BigInt(playwriteProof.pi_b[1][0]), BigInt(playwriteProof.pi_b[1][1])],
  ];
  const playwriteProofC = [BigInt(playwriteProof.pi_c[0]), BigInt(playwriteProof.pi_c[1])];

  await testWithdrawCall(
    "EXACT PLAYWRIGHT parameters with dummy merkle",
    playwriteProofA, playwriteProofB, playwriteProofC,
    ethers.ZeroHash,
    playwriteNullifier,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  );

  await testWithdrawCall(
    "EXACT PLAYWRIGHT parameters with real merkle",
    playwriteProofA, playwriteProofB, playwriteProofC,
    contractRoot,
    playwriteNullifier,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  );

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
