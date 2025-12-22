import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function testWithdrawWithRoot(name: string, merkleRoot: string, checkHistory: boolean = false) {
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    await ethers.provider.getSigner(0)
  );

  const proofA = [1n, 2n];
  const proofB = [[3n, 4n], [5n, 6n]];
  const proofC = [7n, 8n];

  console.log(`\n🧪 ${name}`);
  console.log(`  Root: ${merkleRoot}`);

  if (checkHistory) {
    const inHistory = await privacyPool.rootHistory(merkleRoot);
    console.log(`  In rootHistory: ${inHistory ? "✅ YES" : "❌ NO"}`);
  }

  try {
    await privacyPool.withdraw.staticCall(
      proofA, proofB, proofC,
      merkleRoot,
      ethers.ZeroHash,
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      0n,
      ethers.ZeroAddress
    );
    console.log(`  Result: ✅ Function works`);
    return true;
  } catch (error: any) {
    if (error.message.includes("function selector")) {
      console.log(`  Result: ❌ Function selector not recognized`);
      return false;
    } else {
      console.log(`  Result: ✅ Function works (${error.message.split('\n')[0].slice(0, 50)}...)`);
      return true;
    }
  }
}

async function main() {
  console.log("\n🔬 Testing RootHistory Bug Hypothesis\n");
  console.log("=".repeat(70));

  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  const currentRoot = await privacyPool.merkleRoot();
  console.log("📊 Current merkle root:", currentRoot);

  // Check if it's in rootHistory
  const inHistory = await privacyPool.rootHistory(currentRoot);
  console.log("Is current root in rootHistory:", inHistory ? "✅ YES" : "❌ NO");

  // Test current root
  await testWithdrawWithRoot("Current root (in rootHistory)", currentRoot, true);

  // Create a modified root that's NOT in history
  const modifiedRoot = "0x" + (BigInt(currentRoot) ^ 1n).toString(16).padStart(64, '0');
  await testWithdrawWithRoot("Modified root (XOR 1, NOT in rootHistory)", modifiedRoot, true);

  // Test: Can we add a new root to history by making a deposit?
  console.log("\n📝 Making a test deposit to update merkle tree...");

  const testCommitment = ethers.ZeroHash;
  const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

  try {
    const tx = await privacyPool.deposit(testCommitment, { value: depositAmount });
    await tx.wait();
    console.log("✅ Deposit successful");

    const newRoot = await privacyPool.merkleRoot();
    console.log("New merkle root:", newRoot);

    // Test the NEW root
    await testWithdrawWithRoot("NEW root (just created)", newRoot, true);

    // Test the OLD root (should still be in history)
    await testWithdrawWithRoot("OLD root (previous root)", currentRoot, true);

  } catch (error: any) {
    console.log("❌ Deposit failed:", error.message);
  }

  // Hypothesis: Maybe it's related to calling staticCall on a root that IS in rootHistory
  // Let's try with a completely random root
  console.log("\n🎲 Testing with random roots:");

  const randomRoot1 = "0x" + "1234567890abcdef".repeat(4);
  await testWithdrawWithRoot("Random root 1", randomRoot1, true);

  const randomRoot2 = "0x" + "fedcba0987654321".repeat(4);
  await testWithdrawWithRoot("Random root 2", randomRoot2, true);

  // Test if the issue is position-dependent in calldata
  console.log("\n🔍 Testing calldata encoding:");
  const iface = new ethers.Interface(PrivacyPoolABI.abi);

  // Encode with current root
  const calldata = iface.encodeFunctionData("withdraw", [
    [1n, 2n], [[3n, 4n], [5n, 6n]], [7n, 8n],
    currentRoot,
    ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  ]);

  console.log("Full calldata:", calldata);
  console.log("Length:", calldata.length);

  // Find where merkleRoot appears in calldata
  const rootWithout0x = currentRoot.slice(2);
  const rootPosition = calldata.indexOf(rootWithout0x);
  console.log(`MerkleRoot appears at position: ${rootPosition}`);

  // Try to call directly with raw calldata
  console.log("\n📞 Testing direct eth_call with raw calldata:");
  try {
    await ethers.provider.send("eth_call", [
      {
        to: CONTRACTS.PRIVACY_POOL_ADDRESS,
        data: calldata
      },
      "latest"
    ]);
    console.log("✅ Raw eth_call succeeded");
  } catch (error: any) {
    console.log("❌ Raw eth_call failed:", error.data?.message || error.message);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
