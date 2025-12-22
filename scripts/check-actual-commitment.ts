import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";

async function main() {
  console.log("\n🔍 Checking Actual Deposited Commitment\n");
  console.log("=" .repeat(60));

  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  // Get Deposit events
  const filter = privacyPool.filters.Deposit();
  const events = await privacyPool.queryFilter(filter);

  console.log(`📊 Found ${events.length} deposit event(s):\n`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    console.log(`Deposit ${i}:`);
    console.log(`  Commitment: ${event.args?.commitment}`);
    console.log(`  Leaf Index: ${event.args?.leafIndex}`);
    console.log(`  Timestamp: ${event.args?.timestamp}`);
    console.log(`  Block: ${event.blockNumber}`);
    console.log();
  }

  const merkleRoot = await privacyPool.merkleRoot();
  console.log("🌳 Current Merkle Root:", merkleRoot);

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
