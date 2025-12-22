import { ethers } from "hardhat";

async function main() {
  console.log("\n🔢 Calculating ZERO_VALUE from Contract\n");
  console.log("=" .repeat(60));

  const SNARK_SCALAR_FIELD = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

  const hash = ethers.keccak256(ethers.toUtf8Bytes("PrivacyPool-Zero"));
  console.log("keccak256('PrivacyPool-Zero'):", hash);

  const hashBigInt = BigInt(hash);
  console.log("As BigInt:", hashBigInt.toString());

  const zeroValue = hashBigInt % SNARK_SCALAR_FIELD;
  console.log("ZERO_VALUE (mod SNARK_SCALAR_FIELD):", zeroValue.toString());
  console.log("As hex:", "0x" + zeroValue.toString(16).padStart(64, '0'));

  const frontendDefault = "5738151709701895985996174429509233181681189240650583716378205449277091542814";
  console.log("\nFrontend DEFAULT_ZERO:", frontendDefault);
  console.log("Match:", zeroValue.toString() === frontendDefault ? "✅ YES" : "❌ NO");

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
