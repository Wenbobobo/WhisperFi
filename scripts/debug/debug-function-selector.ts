import { ethers } from "hardhat";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🔍 Function Selector Debug\n");
  console.log("=".repeat(70));

  // Create interface
  const iface = new ethers.Interface(PrivacyPoolABI.abi);

  // Get withdraw function
  const withdrawFunc = iface.getFunction("withdraw");
  console.log("📋 Withdraw Function Info:");
  console.log(`  Name: ${withdrawFunc?.name}`);
  console.log(`  Selector: ${withdrawFunc?.selector}`);
  console.log(`  Signature: ${withdrawFunc?.format()}`);

  // Try to manually encode a call
  const testProofA = ["1", "2"];
  const testProofB = [["3", "4"], ["5", "6"]];
  const testProofC = ["7", "8"];
  const testRoot = ethers.ZeroHash;
  const testNullifier = ethers.ZeroHash;
  const testRecipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const testFee = 0n;
  const testRelayer = ethers.ZeroAddress;

  try {
    const encoded = iface.encodeFunctionData("withdraw", [
      testProofA,
      testProofB,
      testProofC,
      testRoot,
      testNullifier,
      testRecipient,
      testFee,
      testRelayer
    ]);

    console.log(`\n✅ Encoding successful!`);
    console.log(`  Calldata length: ${encoded.length}`);
    console.log(`  First 10 bytes (selector): ${encoded.slice(0, 10)}`);
  } catch (error: any) {
    console.log(`\n❌ Encoding failed: ${error.message}`);
  }

  // Check what's in the deployed contract
  const [signer] = await ethers.getSigners();
  const CONTRACTS = await import("../frontend/src/config/contracts");

  console.log(`\n📍 Checking deployed contract:`);
  console.log(`  Address: ${CONTRACTS.CONTRACTS.PRIVACY_POOL_ADDRESS}`);

  const code = await ethers.provider.getCode(CONTRACTS.CONTRACTS.PRIVACY_POOL_ADDRESS);
  console.log(`  Code exists: ${code !== "0x"}`);
  console.log(`  Code length: ${code.length} bytes`);

  // Try to get contract and check its interface
  try {
    const contract = await ethers.getContractAt(
      "PrivacyPool",
      CONTRACTS.CONTRACTS.PRIVACY_POOL_ADDRESS,
      signer
    );

    console.log(`\n🔍 Contract methods available:`);
    const fragment = contract.interface.getFunction("withdraw");
    console.log(`  withdraw exists: ${fragment !== null}`);
    console.log(`  withdraw selector: ${fragment?.selector}`);

  } catch (error: any) {
    console.log(`\n❌ Error getting contract: ${error.message}`);
  }
}

main().catch(console.error);
