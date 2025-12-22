import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";

async function main() {
  const poseidon = await buildPoseidon();

  const merkleRoot = "0x0467f75ea1b1ea95a52058ef3e29d6e09f4258eac424199d5ca9061f781858ed";
  const nullifierHash = "0x24a3b855d0a89ad666e353ca484cac657c15f27b444cbbbd55d72db12bd7825f";
  const expectedPublicSignal = "6550033267088255920452393472745848470915661371809245392311751045461983212646";

  // Calculate Poseidon hash
  const hash = poseidon([BigInt(merkleRoot), BigInt(nullifierHash)]);
  const hashBigInt = BigInt(poseidon.F.toString(hash));

  console.log("Merkle Root:", merkleRoot);
  console.log("  As BigInt:", BigInt(merkleRoot).toString());
  console.log("\nNullifier Hash:", nullifierHash);
  console.log("  As BigInt:", BigInt(nullifierHash).toString());
  console.log("\nExpected publicSignals[0]:", expectedPublicSignal);
  console.log("\nCalculated Poseidon([root, nullifier]):", hashBigInt.toString());
  console.log("\nMatch:", hashBigInt.toString() === expectedPublicSignal ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
