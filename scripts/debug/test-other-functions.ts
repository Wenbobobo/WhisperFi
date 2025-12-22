import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🔍 Testing Other Contract Functions\n");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    signer
  );

  console.log("📍 Contract Address:", CONTRACTS.PRIVACY_POOL_ADDRESS);

  // Test 1: Read merkleRoot (view function)
  console.log("\n1️⃣  Testing merkleRoot() view function:");
  try {
    const root = await privacyPool.merkleRoot();
    console.log("  ✅ SUCCESS - Merkle root:", root);
  } catch (error: any) {
    console.log("  ❌ FAILED:", error.message);
  }

  // Test 2: Read DEPOSIT_AMOUNT (public constant)
  console.log("\n2️⃣  Testing DEPOSIT_AMOUNT() public constant:");
  try {
    const amount = await privacyPool.DEPOSIT_AMOUNT();
    console.log("  ✅ SUCCESS - Deposit amount:", ethers.formatEther(amount), "ETH");
  } catch (error: any) {
    console.log("  ❌ FAILED:", error.message);
  }

  // Test 3: Read nextLeafIndex (public variable)
  console.log("\n3️⃣  Testing nextLeafIndex() public variable:");
  try {
    const index = await privacyPool.nextLeafIndex();
    console.log("  ✅ SUCCESS - Next leaf index:", index.toString());
  } catch (error: any) {
    console.log("  ❌ FAILED:", error.message);
  }

  // Test 4: Try to call deposit (state-changing function)
  console.log("\n4️⃣  Testing deposit() state-changing function:");
  try {
    const commitment = ethers.ZeroHash;
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    const tx = await privacyPool.deposit(commitment, { value: depositAmount });
    await tx.wait();
    console.log("  ✅ SUCCESS - Deposit succeeded");
  } catch (error: any) {
    console.log("  ❌ FAILED:", error.message);
  }

  // Test 5: List all functions in the ABI
  console.log("\n📋 All functions in ABI:");
  const iface = new ethers.Interface(PrivacyPoolABI.abi);
  iface.fragments.forEach((fragment) => {
    if (fragment.type === "function") {
      const func = fragment as ethers.FunctionFragment;
      console.log(`  - ${func.name}: ${func.selector}`);
    }
  });

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
