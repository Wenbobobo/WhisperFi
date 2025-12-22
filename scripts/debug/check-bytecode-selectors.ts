import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";

async function main() {
  console.log("\n🔍 Checking Function Selectors in Bytecode\n");
  console.log("=".repeat(70));

  const code = await ethers.provider.getCode(CONTRACTS.PRIVACY_POOL_ADDRESS);

  console.log(`Contract: ${CONTRACTS.PRIVACY_POOL_ADDRESS}`);
  console.log(`Bytecode length: ${code.length} characters`);

  // Search for withdraw selector 0x1e11b9ea
  const withdrawSelector = "1e11b9ea";
  const found = code.toLowerCase().includes(withdrawSelector);

  console.log(`\nSearching for withdraw selector: 0x${withdrawSelector}`);
  console.log(`Found in bytecode: ${found ? "✅ YES" : "❌ NO"}`);

  if (found) {
    const index = code.toLowerCase().indexOf(withdrawSelector);
    console.log(`Position: ${index} / ${code.length}`);
  }

  // Also check for other known function selectors
  const selectors = [
    { name: "deposit", selector: "b214faa5" },
    { name: "merkleRoot", selector: "2eb4a7ab" },
    { name: "trade", selector: "b923d7d1" }
  ];

  console.log(`\nChecking other functions:`);
  for (const { name, selector } of selectors) {
    const found = code.toLowerCase().includes(selector);
    console.log(`  ${name} (0x${selector}): ${found ? "✅" : "❌"}`);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
