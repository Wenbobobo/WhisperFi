import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🔍 Testing Raw RPC Call\n");
  console.log("=".repeat(70));

  // Encode the function call manually
  const iface = new ethers.Interface(PrivacyPoolABI.abi);
  const calldata = iface.encodeFunctionData("withdraw", [
    [1n, 2n],  // proofA
    [[3n, 4n], [5n, 6n]],  // proofB
    [7n, 8n],  // proofC
    ethers.ZeroHash,  // merkleRoot
    ethers.ZeroHash,  // nullifier
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  // recipient
    0n,  // fee
    ethers.ZeroAddress  // relayer
  ]);

  console.log(`Contract: ${CONTRACTS.PRIVACY_POOL_ADDRESS}`);
  console.log(`Calldata: ${calldata.slice(0, 100)}...`);
  console.log(`Function selector: ${calldata.slice(0, 10)}`);

  // Try using eth_call directly
  console.log("\n📞 Making direct eth_call...");
  try {
    const result = await ethers.provider.send("eth_call", [
      {
        to: CONTRACTS.PRIVACY_POOL_ADDRESS,
        data: calldata
      },
      "latest"
    ]);
    console.log("✅ SUCCESS! Result:", result);
  } catch (error: any) {
    console.log("❌ FAILED!");
    console.log("Error:", JSON.stringify(error, null, 2));
  }

  // Also try eth_estimateGas
  console.log("\n⛽ Estimating gas...");
  try {
    const gas = await ethers.provider.send("eth_estimateGas", [
      {
        to: CONTRACTS.PRIVACY_POOL_ADDRESS,
        data: calldata,
        from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      }
    ]);
    console.log("✅ Gas estimate:", gas);
  } catch (error: any) {
    console.log("❌ Gas estimation failed!");
    console.log("Error:", JSON.stringify(error, null, 2));
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
