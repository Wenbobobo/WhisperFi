import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🔍 Testing Withdraw Static Call\n");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    signer
  );

  // Use dummy values for testing
  const proofA = [1n, 2n];
  const proofB = [[3n, 4n], [5n, 6n]];
  const proofC = [7n, 8n];
  const merkleRoot = ethers.ZeroHash;
  const nullifier = ethers.ZeroHash;
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  console.log("Testing withdraw.staticCall with dummy parameters...");

  try {
    const result = await privacyPool.withdraw.staticCall(
      proofA,
      proofB,
      proofC,
      merkleRoot,
      nullifier,
      recipient,
      fee,
      relayer
    );
    console.log("  ✅ Static call succeeded:", result);
  } catch (error: any) {
    console.log("  ❌ Static call failed:");
    console.log("  Error:", error.message);

    if (error.data) {
      console.log("  Data:", error.data);
    }

    // Try to decode the error
    if (error.data && error.data.startsWith && error.data.startsWith('0x08c379a0')) {
      try {
        const reason = ethers.AbiCoder.defaultAbiCoder().decode(
          ['string'],
          '0x' + error.data.slice(10)
        );
        console.log("  Decoded reason:", reason[0]);
      } catch (e) {
        console.log("  Could not decode error reason");
      }
    }
  }

  // Also try manually encoding and calling
  console.log("\n📝 Trying manual encoding...");
  const iface = new ethers.Interface(PrivacyPoolABI.abi);
  const calldata = iface.encodeFunctionData("withdraw", [
    proofA,
    proofB,
    proofC,
    merkleRoot,
    nullifier,
    recipient,
    fee,
    relayer
  ]);

  console.log(`  Calldata: ${calldata.slice(0, 100)}...`);
  console.log(`  Selector: ${calldata.slice(0, 10)}`);

  try {
    const result = await ethers.provider.call({
      to: CONTRACTS.PRIVACY_POOL_ADDRESS,
      data: calldata
    });
    console.log("  ✅ eth_call succeeded:", result);
  } catch (error: any) {
    console.log("  ❌ eth_call failed:", error.message);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
