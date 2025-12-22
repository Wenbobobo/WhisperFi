import { ethers } from "hardhat";

async function main() {
  console.log("\n🧪 Testing Simple Withdraw Contract\n");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();

  // Deploy TestWithdraw with constructor args
  console.log("📦 Deploying TestWithdraw...");
  const TestWithdraw = await ethers.getContractFactory("TestWithdraw", signer);
  const testWithdraw = await TestWithdraw.deploy(
    ethers.ZeroAddress,  // verifier
    ethers.ZeroAddress,  // hasher
    ethers.ZeroAddress   // hasher5
  );
  await testWithdraw.waitForDeployment();
  const address = await testWithdraw.getAddress();
  console.log(`✅ Deployed to: ${address}`);

  // Test with dummy values
  const proofA = [1n, 2n];
  const proofB = [[3n, 4n], [5n, 6n]];
  const proofC = [7n, 8n];
  const merkleRoot = ethers.ZeroHash;
  const nullifier = ethers.ZeroHash;
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  console.log("\n🔍 Testing withdraw with dummy values...");
  try {
    const tx = await testWithdraw.withdraw(
      proofA,
      proofB,
      proofC,
      merkleRoot,
      nullifier,
      recipient,
      fee,
      relayer
    );
    await tx.wait();
    console.log("✅ SUCCESS! Withdraw function works!");
  } catch (error: any) {
    console.log("❌ FAILED:", error.message);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
