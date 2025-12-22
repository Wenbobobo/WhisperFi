import { ethers } from "hardhat";

async function main() {
  console.log("\n🔍 Checking Sepolia Balance\n");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();
  const balance = await ethers.provider.getBalance(address);

  console.log("📍 Wallet Information:");
  console.log(`  Address: ${address}`);
  console.log(`  Balance: ${ethers.formatEther(balance)} SepoliaETH`);

  const network = await ethers.provider.getNetwork();
  console.log(`\n🌐 Network Information:`);
  console.log(`  Name: ${network.name}`);
  console.log(`  Chain ID: ${network.chainId}`);

  if (balance < ethers.parseEther("0.1")) {
    console.log(`\n⚠️  WARNING: Low balance!`);
    console.log(`  You need at least 0.5 SepoliaETH for deployment and testing`);
    console.log(`  Get test ETH from: https://sepoliafaucet.com/`);
  } else {
    console.log(`\n✅ Balance is sufficient for deployment and testing`);
  }

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
