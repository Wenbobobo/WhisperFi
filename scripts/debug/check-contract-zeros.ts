import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { CONTRACTS } from "../frontend/src/config/contracts";

async function main() {
  console.log("\n🔍 Checking Contract Zeros Array\n");
  console.log("=" .repeat(60));

  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  console.log("📊 Reading zeros from contract:");
  const contractZeros: string[] = [];
  for (let i = 0; i < 16; i++) {
    const zero = await privacyPool.zeros(i);
    contractZeros.push(zero);
    console.log(`  zeros[${i}] = ${zero}`);
  }

  console.log("\n🧮 Calculating expected zeros:");
  const poseidon = await buildPoseidon();
  const expectedZeros: string[] = [];
  let currentZero = BigInt(0);
  for (let i = 0; i < 16; i++) {
    expectedZeros.push("0x" + currentZero.toString(16).padStart(64, '0'));
    console.log(`  zeros[${i}] = 0x${currentZero.toString(16).padStart(64, '0')}`);
    currentZero = BigInt(poseidon.F.toString(poseidon([currentZero, currentZero])));
  }

  console.log("\n✅ Comparison:");
  let allMatch = true;
  for (let i = 0; i < 16; i++) {
    const match = contractZeros[i].toLowerCase() === expectedZeros[i].toLowerCase();
    if (!match) {
      console.log(`  ❌ Level ${i}: MISMATCH`);
      console.log(`     Contract: ${contractZeros[i]}`);
      console.log(`     Expected: ${expectedZeros[i]}`);
      allMatch = false;
    } else {
      console.log(`  ✅ Level ${i}: Match`);
    }
  }

  console.log("\n" + (allMatch ? "✅ All zeros match!" : "❌ Some zeros don't match!"));
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
