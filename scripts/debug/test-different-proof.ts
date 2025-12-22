import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🧪 Testing with Different Proof Values\n");
  console.log("=".repeat(70));

  // Use DIFFERENT secret and amount
  const secret = BigInt("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  const amount = BigInt("50000000000000000"); // 0.05 ETH instead of 0.1
  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

  const [signer] = await ethers.getSigners();
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    signer
  );

  console.log("⚙️  Generating ZK Proof with NEW secret/amount...");
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

  console.log(`✅ Proof generated!`);

  // Format proof
  const proofA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const proofB = [
    [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
    [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])],
  ];
  const proofC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

  console.log(`\nProof values:`);
  console.log(`  proofA:`, proofA.map(v => v.toString().slice(0, 20) + "..."));
  console.log(`  proofB[0]:`, proofB[0].map(v => v.toString().slice(0, 20) + "..."));
  console.log(`  proofB[1]:`, proofB[1].map(v => v.toString().slice(0, 20) + "..."));
  console.log(`  proofC:`, proofC.map(v => v.toString().slice(0, 20) + "..."));

  const merkleRoot = ethers.ZeroHash;
  const nullifier = ethers.ZeroHash;
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  console.log(`\n🔍 Testing staticCall...`);
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
    console.log("✅ SUCCESS!");
  } catch (error: any) {
    if (error.message.includes("function selector")) {
      console.log("❌ FAILED: Function selector not recognized");
    } else {
      console.log(`✅ Function recognized! Error: ${error.message.split('\n')[0]}`);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
