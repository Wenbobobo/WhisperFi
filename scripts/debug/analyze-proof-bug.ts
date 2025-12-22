import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function testProofValues(name: string, proofA: bigint[], proofB: bigint[][], proofC: bigint[]) {
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    await ethers.provider.getSigner(0)
  );

  const merkleRoot = ethers.ZeroHash;
  const nullifier = ethers.ZeroHash;
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

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
    return "✅ Function recognized";
  } catch (error: any) {
    if (error.message.includes("function selector")) {
      return "❌ Function selector NOT recognized";
    } else {
      return `✅ Function recognized (${error.message.split('\n')[0].slice(0, 50)}...)`;
    }
  }
}

async function main() {
  console.log("\n🔬 Analyzing Proof Value Bug\n");
  console.log("=".repeat(70));

  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";
  const poseidon = await buildPoseidon();

  // Test 1: PLAYWRIGHT secret (FAILS)
  console.log("\n📊 Test 1: PLAYWRIGHT Secret (Known to FAIL)");
  const secret1 = BigInt("0x8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91");
  const amount1 = BigInt("100000000000000000");

  const { proof: proof1 } = await groth16.fullProve(
    {
      secret: secret1.toString(),
      amount: amount1.toString(),
      pathElements: Array(16).fill("0"),
      pathIndices: Array(16).fill(0)
    },
    "frontend/public/zk/withdraw.wasm",
    "frontend/public/zk/withdraw.zkey"
  );

  const proofA1 = [BigInt(proof1.pi_a[0]), BigInt(proof1.pi_a[1])];
  const proofB1 = [
    [BigInt(proof1.pi_b[0][0]), BigInt(proof1.pi_b[0][1])],
    [BigInt(proof1.pi_b[1][0]), BigInt(proof1.pi_b[1][1])],
  ];
  const proofC1 = [BigInt(proof1.pi_c[0]), BigInt(proof1.pi_c[1])];

  console.log("  Secret:", secret1.toString());
  console.log("  Amount:", amount1.toString());
  console.log("  Proof A:", proofA1.map(v => v.toString()));
  console.log("  Proof B[0]:", proofB1[0].map(v => v.toString()));
  console.log("  Proof B[1]:", proofB1[1].map(v => v.toString()));
  console.log("  Proof C:", proofC1.map(v => v.toString()));

  const result1 = await testProofValues("PLAYWRIGHT", proofA1, proofB1, proofC1);
  console.log("  Result:", result1);

  // Test 2: Different secret (WORKS)
  console.log("\n📊 Test 2: Different Secret (Known to WORK)");
  const secret2 = BigInt("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  const amount2 = BigInt("50000000000000000");

  const { proof: proof2 } = await groth16.fullProve(
    {
      secret: secret2.toString(),
      amount: amount2.toString(),
      pathElements: Array(16).fill("0"),
      pathIndices: Array(16).fill(0)
    },
    "frontend/public/zk/withdraw.wasm",
    "frontend/public/zk/withdraw.zkey"
  );

  const proofA2 = [BigInt(proof2.pi_a[0]), BigInt(proof2.pi_a[1])];
  const proofB2 = [
    [BigInt(proof2.pi_b[0][0]), BigInt(proof2.pi_b[0][1])],
    [BigInt(proof2.pi_b[1][0]), BigInt(proof2.pi_b[1][1])],
  ];
  const proofC2 = [BigInt(proof2.pi_c[0]), BigInt(proof2.pi_c[1])];

  console.log("  Secret:", secret2.toString());
  console.log("  Amount:", amount2.toString());
  console.log("  Proof A:", proofA2.map(v => v.toString()));
  console.log("  Proof B[0]:", proofB2[0].map(v => v.toString()));
  console.log("  Proof B[1]:", proofB2[1].map(v => v.toString()));
  console.log("  Proof C:", proofC2.map(v => v.toString()));

  const result2 = await testProofValues("Different", proofA2, proofB2, proofC2);
  console.log("  Result:", result2);

  // Analyze differences
  console.log("\n🔍 Analyzing Differences:");

  // Check for specific patterns
  const allValues1 = [...proofA1, ...proofB1[0], ...proofB1[1], ...proofC1];
  const allValues2 = [...proofA2, ...proofB2[0], ...proofB2[1], ...proofC2];

  console.log("\n  Value Statistics (FAILING proof):");
  console.log("    Min:", allValues1.reduce((a, b) => a < b ? a : b).toString());
  console.log("    Max:", allValues1.reduce((a, b) => a > b ? a : b).toString());
  console.log("    Values < 1000:", allValues1.filter(v => v < 1000n).length);
  console.log("    Values = 0:", allValues1.filter(v => v === 0n).length);
  console.log("    Values = 1:", allValues1.filter(v => v === 1n).length);

  console.log("\n  Value Statistics (WORKING proof):");
  console.log("    Min:", allValues2.reduce((a, b) => a < b ? a : b).toString());
  console.log("    Max:", allValues2.reduce((a, b) => a > b ? a : b).toString());
  console.log("    Values < 1000:", allValues2.filter(v => v < 1000n).length);
  console.log("    Values = 0:", allValues2.filter(v => v === 0n).length);
  console.log("    Values = 1:", allValues2.filter(v => v === 1n).length);

  // Test hypothesis: Is it the presence of very small values?
  console.log("\n🧪 Testing Hypothesis: Small values in proof arrays");

  // Test 3: Manually replace small values in failing proof
  const proofB1_modified = [
    [...proofB1[0]],
    [1000n, 2000n] // Replace the small values
  ];

  console.log("\n  Test 3: PLAYWRIGHT proof with B[1] replaced by [1000, 2000]");
  const result3 = await testProofValues("Modified", proofA1, proofB1_modified, proofC1);
  console.log("  Result:", result3);

  // Test 4: Use working proof but inject small values
  const proofB2_modified = [
    [...proofB2[0]],
    [1n, 0n] // Inject the pattern from failing proof
  ];

  console.log("\n  Test 4: Working proof with B[1] replaced by [1, 0]");
  const result4 = await testProofValues("Modified2", proofA2, proofB2_modified, proofC2);
  console.log("  Result:", result4);

  // Encode both and compare
  console.log("\n📝 Calldata Analysis:");
  const iface = new ethers.Interface(PrivacyPoolABI.abi);

  const calldata1 = iface.encodeFunctionData("withdraw", [
    proofA1, proofB1, proofC1,
    ethers.ZeroHash, ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n, ethers.ZeroAddress
  ]);

  const calldata2 = iface.encodeFunctionData("withdraw", [
    proofA2, proofB2, proofC2,
    ethers.ZeroHash, ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n, ethers.ZeroAddress
  ]);

  console.log("  FAILING calldata length:", calldata1.length);
  console.log("  WORKING calldata length:", calldata2.length);
  console.log("  Selector match:", calldata1.slice(0, 10) === calldata2.slice(0, 10));

  // Check if there are null bytes or unusual patterns
  const hasNullBytes1 = calldata1.includes("0000000000000000000000000000000000000000000000000000000000000000");
  const hasNullBytes2 = calldata2.includes("0000000000000000000000000000000000000000000000000000000000000000");
  console.log("  FAILING has 32-byte zero chunks:", hasNullBytes1);
  console.log("  WORKING has 32-byte zero chunks:", hasNullBytes2);

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
