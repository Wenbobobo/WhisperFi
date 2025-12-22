import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function testMerkleRoot(name: string, merkleRoot: string) {
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    await ethers.provider.getSigner(0)
  );

  // Use simple dummy proof values
  const proofA = [1n, 2n];
  const proofB = [[3n, 4n], [5n, 6n]];
  const proofC = [7n, 8n];
  const nullifier = ethers.ZeroHash;
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  console.log(`\n🧪 ${name}`);
  console.log(`  Merkle Root: ${merkleRoot}`);

  try {
    await privacyPool.withdraw.staticCall(
      proofA, proofB, proofC,
      merkleRoot, nullifier, recipient, fee, relayer
    );
    console.log(`  ✅ WORKS`);
    return true;
  } catch (error: any) {
    if (error.message.includes("function selector")) {
      console.log(`  ❌ FAILS - Function selector not recognized`);
      return false;
    } else {
      console.log(`  ✅ WORKS - ${error.message.split('\n')[0].slice(0, 50)}...`);
      return true;
    }
  }
}

async function main() {
  console.log("\n🔬 Analyzing MerkleRoot Bug\n");
  console.log("=".repeat(70));

  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );
  const currentRoot = await privacyPool.merkleRoot();

  console.log("📊 Current contract merkle root:");
  console.log(`  ${currentRoot}`);
  console.log(`  Binary: ${BigInt(currentRoot).toString(2).padStart(256, '0')}`);
  console.log(`  Decimal: ${BigInt(currentRoot).toString()}`);

  // Analyze the problematic root
  const rootBigInt = BigInt(currentRoot);
  const rootBytes = ethers.getBytes(currentRoot);

  console.log("\n🔍 Root characteristics:");
  console.log(`  First byte: 0x${rootBytes[0].toString(16).padStart(2, '0')}`);
  console.log(`  Last byte: 0x${rootBytes[31].toString(16).padStart(2, '0')}`);
  console.log(`  Has leading zeros: ${currentRoot.startsWith('0x00')}`);
  console.log(`  Has trailing zeros: ${currentRoot.endsWith('00')}`);

  // Count specific byte patterns
  const hexStr = currentRoot.slice(2);
  const has11 = hexStr.includes('11');
  const has32 = hexStr.includes('32');
  const hasb0 = hexStr.includes('b0');
  const has1a = hexStr.includes('1a');

  console.log(`  Contains '11': ${has11}`);
  console.log(`  Contains '32': ${has32}`);
  console.log(`  Contains 'b0': ${hasb0}`);
  console.log(`  Contains '1a': ${has1a}`);

  // Test variations of the root
  console.log("\n🧪 Testing Variations:");

  await testMerkleRoot("Original (FAILING)", currentRoot);
  await testMerkleRoot("ZeroHash (WORKING)", ethers.ZeroHash);
  await testMerkleRoot("MaxUint256", "0x" + "f".repeat(64));

  // Try flipping specific bits
  const rootMod1 = "0x" + (rootBigInt ^ 1n).toString(16).padStart(64, '0');
  await testMerkleRoot("Original XOR 1", rootMod1);

  const rootMod2 = "0x" + (rootBigInt ^ (1n << 255n)).toString(16).padStart(64, '0');
  await testMerkleRoot("Original with flipped MSB", rootMod2);

  // Try different specific values
  await testMerkleRoot("0x1111...1111", "0x" + "1".repeat(64));
  await testMerkleRoot("0x1234...5678", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");

  // Try first half of problematic root
  const firstHalf = currentRoot.slice(0, 34) + "0".repeat(30);
  await testMerkleRoot("First half of problematic root", firstHalf);

  // Try second half
  const secondHalf = "0x" + "0".repeat(30) + currentRoot.slice(34);
  await testMerkleRoot("Second half of problematic root", secondHalf);

  // Try just changing first byte
  const modFirstByte = "0x00" + currentRoot.slice(4);
  await testMerkleRoot("Problematic root with 0x00 first byte", modFirstByte);

  const modFirstByte2 = "0xff" + currentRoot.slice(4);
  await testMerkleRoot("Problematic root with 0xff first byte", modFirstByte2);

  // Extract and test the specific problematic byte pattern
  console.log("\n🎯 Testing Specific Byte Patterns:");

  // The root starts with 0x1132b01a...
  // Let's test if this prefix is the issue
  await testMerkleRoot("0x1132b01a + zeros", "0x1132b01a" + "0".repeat(56));
  await testMerkleRoot("0x1132 + zeros", "0x1132" + "0".repeat(60));
  await testMerkleRoot("0x11 + zeros", "0x11" + "0".repeat(62));

  // Test the full pattern
  console.log("\n📝 Calldata Analysis:");
  const iface = new ethers.Interface(PrivacyPoolABI.abi);

  const calldata1 = iface.encodeFunctionData("withdraw", [
    [1n, 2n], [[3n, 4n], [5n, 6n]], [7n, 8n],
    ethers.ZeroHash,  // Works
    ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n, ethers.ZeroAddress
  ]);

  const calldata2 = iface.encodeFunctionData("withdraw", [
    [1n, 2n], [[3n, 4n], [5n, 6n]], [7n, 8n],
    currentRoot,  // Fails
    ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n, ethers.ZeroAddress
  ]);

  console.log("\nWorking calldata (ZeroHash):");
  console.log(`  Length: ${calldata1.length}`);
  console.log(`  Selector: ${calldata1.slice(0, 10)}`);
  console.log(`  MerkleRoot position: ${calldata1.slice(586, 650)}`);

  console.log("\nFailing calldata (Real Root):");
  console.log(`  Length: ${calldata2.length}`);
  console.log(`  Selector: ${calldata2.slice(0, 10)}`);
  console.log(`  MerkleRoot position: ${calldata2.slice(586, 650)}`);

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
