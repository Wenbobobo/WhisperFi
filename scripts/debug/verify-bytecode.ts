import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolArtifact from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🔍 Bytecode Verification\n");
  console.log("=".repeat(70));

  const deployedCode = await ethers.provider.getCode(CONTRACTS.PRIVACY_POOL_ADDRESS);
  const artifactBytecode = PrivacyPoolArtifact.bytecode;

  console.log("📦 Artifact Bytecode Info:");
  console.log(`  Length: ${artifactBytecode.length} characters`);
  console.log(`  First 20 chars: ${artifactBytecode.slice(0, 20)}`);

  console.log("\n📍 Deployed Bytecode Info:");
  console.log(`  Address: ${CONTRACTS.PRIVACY_POOL_ADDRESS}`);
  console.log(`  Length: ${deployedCode.length} characters`);
  console.log(`  First 20 chars: ${deployedCode.slice(0, 20)}`);

  console.log("\n🔍 Checking for withdraw function selector (0x1e11b9ea) in deployed code:");
  const selector = "1e11b9ea";
  const foundInDeployed = deployedCode.includes(selector);
  console.log(`  Found in deployed: ${foundInDeployed ? "✅" : "❌"}`);

  // Check ABI
  console.log("\n📋 ABI Analysis:");
  const abi = PrivacyPoolArtifact.abi;
  const withdrawFunc = abi.find((x: any) => x.name === "withdraw");
  console.log(`  withdraw function in ABI: ${withdrawFunc ? "✅" : "❌"}`);
  if (withdrawFunc) {
    console.log(`  Type: ${withdrawFunc.type}`);
    console.log(`  Inputs: ${withdrawFunc.inputs.length}`);
    console.log(`  Input types: ${withdrawFunc.inputs.map((i: any) => i.type).join(", ")}`);
  }

  // Try calling with ethers interface
  const iface = new ethers.Interface(abi);
  const fragment = iface.getFunction("withdraw");
  console.log(`\n🔧 Ethers Interface:`);
  console.log(`  Function selector: ${fragment?.selector}`);
  console.log(`  Function signature: ${fragment?.format()}`);

  // Check if bytecode matches
  console.log(`\n🔎 Bytecode Match:`);
  if (deployedCode === artifactBytecode) {
    console.log(`  ✅ Deployed bytecode exactly matches artifact`);
  } else {
    console.log(`  ⚠️  Deployed bytecode differs from artifact`);
    console.log(`  This might be due to constructor args or immutable variables`);
  }
}

main().catch(console.error);
