import { groth16 } from "snarkjs";
import { buildPoseidon } from "circomlibjs";

async function main() {
  console.log("\n🔍 Debugging Proof Values\n");
  console.log("=".repeat(70));

  const secret = BigInt("0x8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91");
  const amount = BigInt("100000000000000000");
  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

  // Generate a proof
  console.log("⚙️  Generating proof...");

  const pathElements = Array(16).fill("0");
  const pathIndices = Array(16).fill(0);

  const circuitInput = {
    secret: secret.toString(),
    amount: amount.toString(),
    pathElements,
    pathIndices
  };

  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    "frontend/public/zk/withdraw.wasm",
    "frontend/public/zk/withdraw.zkey"
  );

  console.log("✅ Proof generated!");
  console.log("\n📊 Raw proof values:");
  console.log("pi_a:", proof.pi_a);
  console.log("pi_b:", proof.pi_b);
  console.log("pi_c:", proof.pi_c);

  console.log("\n🔢 Converting to BigInt:");
  const proofA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const proofB = [
    [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
    [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])],
  ];
  const proofC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

  console.log("proofA:", proofA);
  console.log("proofB:", proofB);
  console.log("proofC:", proofC);

  // Check if any value is negative or zero
  console.log("\n✅ Validation:");
  const allValues = [
    ...proofA,
    ...proofB[0],
    ...proofB[1],
    ...proofC
  ];

  allValues.forEach((val, idx) => {
    if (val <= 0n) {
      console.log(`  ❌ Value ${idx} is <= 0: ${val}`);
    } else {
      console.log(`  ✅ Value ${idx} is valid: ${val.toString().slice(0, 20)}...`);
    }
  });

  // Check if values are within SNARK field
  const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  allValues.forEach((val, idx) => {
    if (val >= SNARK_FIELD) {
      console.log(`  ❌ Value ${idx} exceeds SNARK field!`);
    }
  });

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
