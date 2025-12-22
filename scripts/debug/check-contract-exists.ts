import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";

async function main() {
  const code = await ethers.provider.getCode(CONTRACTS.PRIVACY_POOL_ADDRESS);
  console.log("Contract address:", CONTRACTS.PRIVACY_POOL_ADDRESS);
  console.log("Contract code length:", code.length);
  console.log("Contract exists:", code !== "0x");

  if (code !== "0x") {
    // Try to call a simple function
    const PrivacyPool = await ethers.getContractAt("PrivacyPool", CONTRACTS.PRIVACY_POOL_ADDRESS);
    const root = await PrivacyPool.merkleRoot();
    console.log("Merkle root:", root);
    console.log("✅ Contract is accessible");
  }
}

main().catch(console.error);
