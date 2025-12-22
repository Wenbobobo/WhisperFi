import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import { PLAYWRIGHT_NOTE_SECRET } from "../playwright/constants/e2e";

async function main() {
  console.log("\n💰 Seeding Sepolia Deposit\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    deployer
  );

  const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
  console.log(`  Deposit amount: ${ethers.formatEther(depositAmount)} ETH`);

  const secretValue = BigInt(PLAYWRIGHT_NOTE_SECRET);
  const commitment = await privacyPool.calculateCommitment(
    secretValue,
    depositAmount
  );

  console.log(`  Commitment: ${commitment}`);
  console.log(`  Deployer: ${await deployer.getAddress()}`);

  console.log("\n📝 Making deposit...");
  const tx = await privacyPool.deposit(commitment, { value: depositAmount });
  console.log(`  Transaction: ${tx.hash}`);

  console.log("  ⏳ Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`  ✅ Confirmed in block ${receipt?.blockNumber}`);

  const merkleRoot = await privacyPool.merkleRoot();
  console.log(`\n🌳 Merkle Root: ${merkleRoot}`);

  console.log("\n📊 Test Data:");
  console.log(JSON.stringify({
    network: "sepolia",
    privacyPoolAddress: CONTRACTS.PRIVACY_POOL_ADDRESS,
    merkleRoot,
    commitment,
    depositAmount: depositAmount.toString(),
    secret: PLAYWRIGHT_NOTE_SECRET,
    note: `private-defi-${PLAYWRIGHT_NOTE_SECRET.slice(2)}-${commitment.slice(2)}-v1`
  }, null, 2));

  console.log("\n✅ Deposit seeded successfully!");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
