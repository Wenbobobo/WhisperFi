import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { CONTRACTS } from "../frontend/src/config/contracts";

const NOTE = "0x0327ffa95e2c50b8000000000000000000000000000000000056bc75e2d63100000";

async function main() {
  console.log("\n🌳 Getting Merkle Path for Commitment\n");
  console.log("=" .repeat(60));

  const secret = BigInt("0x0327ffa95e2c50b8");
  const amount = BigInt("100000000000000000");

  const poseidon = await buildPoseidon();
  const commitmentHash = poseidon([secret, amount]);
  const commitment = poseidon.F.toString(commitmentHash);

  console.log("🔐 Commitment:", commitment);

  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  const merkleRoot = await privacyPool.merkleRoot();
  console.log("🌳 Current Merkle Root:", merkleRoot);

  const treeDepth = 16; // Fixed depth from contract
  console.log("📏 Tree Depth:", treeDepth);

  // Get the commitment index
  const nextLeafIndex = await privacyPool.nextLeafIndex();
  console.log("📊 Next Leaf Index:", nextLeafIndex.toString());
  console.log("📍 Our commitment should be at index:", (Number(nextLeafIndex) - 1).toString());

  // Since we just deposited one commitment, it should be at index 0
  // Let's verify by checking if the root matches what we calculate

  // Calculate the zeros array (precomputed zero hashes at each level)
  // ZERO_VALUE = keccak256("PrivacyPool-Zero") % SNARK_SCALAR_FIELD
  const ZERO_VALUE = BigInt("5738151709701895985996174429509233181681189240650583716378205449277091542814");

  const zeros: bigint[] = [];
  let currentZero = ZERO_VALUE;
  console.log("\n🔢 Calculating zeros array (precomputed empty subtree hashes):");
  for (let i = 0; i < treeDepth; i++) {
    zeros.push(currentZero);
    console.log(`  zeros[${i}] = ${currentZero.toString()}`);
    currentZero = BigInt(poseidon.F.toString(poseidon([currentZero, currentZero])));
  }

  // For a tree with only one element at index 0, the path is straightforward
  const index = 0;

  let currentHash = BigInt(commitment);
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  console.log("\n🛤️  Calculating Merkle path:");
  console.log("  Starting with commitment:", currentHash.toString());

  for (let i = 0; i < treeDepth; i++) {
    const isLeft = (index >> i) & 1;
    pathIndices.push(isLeft);
    pathElements.push(zeros[i]);

    if (isLeft === 0) {
      // Current is on left, zero hash is on right
      currentHash = BigInt(poseidon.F.toString(poseidon([currentHash, zeros[i]])));
    } else {
      // Current is on right, zero hash is on left
      currentHash = BigInt(poseidon.F.toString(poseidon([zeros[i], currentHash])));
    }

    console.log(`  Level ${i}: hash = ${currentHash.toString()}, sibling = ${zeros[i].toString()}, isLeft = ${isLeft}`);
  }

  const calculatedRoot = currentHash;
  console.log("\n✅ Calculated Root:", "0x" + calculatedRoot.toString(16).padStart(64, '0'));
  console.log("📋 Contract Root:  ", merkleRoot);
  console.log("🔍 Match:", calculatedRoot === BigInt(merkleRoot) ? "✅ YES" : "❌ NO");

  console.log("\n📤 Merkle Path:");
  console.log("  pathElements:", JSON.stringify(pathElements.map(x => x.toString())));
  console.log("  pathIndices:", JSON.stringify(pathIndices));

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
