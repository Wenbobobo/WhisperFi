// scripts/deploy-and-test.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting complete deployment and test...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await deployer.provider.getBalance(deployer.address))
  );

  // 1. Deploy Verifier
  console.log("\n📝 Deploying Verifier...");
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✅ Verifier deployed to:", verifierAddress);

  // 2. Deploy Executor
  console.log("\n📝 Deploying Executor...");
  const Executor = await ethers.getContractFactory("Executor");
  const executor = await Executor.deploy(deployer.address);
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();
  console.log("✅ Executor deployed to:", executorAddress);

  // 3. Deploy PrivacyPool
  console.log("\n📝 Deploying PrivacyPool...");
  const zeroValue = ethers.encodeBytes32String("zero");
  const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
  const privacyPool = await PrivacyPool.deploy(
    verifierAddress,
    zeroValue,
    deployer.address
  );
  await privacyPool.waitForDeployment();
  const privacyPoolAddress = await privacyPool.getAddress();
  console.log("✅ PrivacyPool deployed to:", privacyPoolAddress);

  // 4. Update frontend configuration
  const configContent = `// Auto-generated configuration
export const CONTRACTS = {
  PRIVACY_POOL_ADDRESS: "${privacyPoolAddress}",
  VERIFIER_ADDRESS: "${verifierAddress}",
  EXECUTOR_ADDRESS: "${executorAddress}",
  DEPLOYER_ADDRESS: "${deployer.address}",
  NETWORK: "localhost:8545"
};

export const DEPLOYMENT_INFO = {
  timestamp: "${new Date().toISOString()}",
  block: ${await deployer.provider.getBlockNumber()}
};
`;

  const frontendConfigPath = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "config",
    "contracts.ts"
  );
  const configDir = path.dirname(frontendConfigPath);

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(frontendConfigPath, configContent);
  console.log("✅ Frontend configuration updated:", frontendConfigPath);

  // 5. Test deposit with the same logic as frontend
  console.log("\n🔄 Testing deposit with frontend logic...");

  // Import Poseidon for testing
  const { buildPoseidon } = require("circomlibjs");
  const poseidon = await buildPoseidon();

  function hexToBigInt(hex) {
    return BigInt(hex);
  }

  function poseidonHash(inputs) {
    const hash = poseidon(inputs);
    return "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
  }

  function generateCommitment(secret, nullifier) {
    const secretBigInt = hexToBigInt(secret);
    const nullifierBigInt = hexToBigInt(nullifier);
    return poseidonHash([secretBigInt, nullifierBigInt]);
  }

  // Use the same secret as frontend test
  const secretNote = "test-deposit-123";
  const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secretNote));
  const nullifier = ethers.keccak256(
    ethers.toUtf8Bytes(`nullifier-${secretNote}`)
  );
  const commitment = generateCommitment(secretHash, nullifier);

  console.log("Test deposit details:");
  console.log("  Secret note:", secretNote);
  console.log("  Secret hash:", secretHash);
  console.log("  Nullifier:", nullifier);
  console.log("  Commitment:", commitment);

  // Make deposit
  const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
  console.log("  Deposit amount:", ethers.formatEther(depositAmount), "ETH");

  const tx = await privacyPool.deposit(commitment, { value: depositAmount });
  const receipt = await tx.wait();

  console.log("✅ Deposit successful!");
  console.log("  Transaction hash:", receipt.hash);
  console.log("  Block number:", receipt.blockNumber);

  // 6. Verify the deposit can be found
  console.log("\n🔍 Verifying deposit can be found...");
  const depositEvents = await privacyPool.queryFilter(
    privacyPool.filters.Deposit()
  );
  console.log("Found", depositEvents.length, "deposit events:");

  depositEvents.forEach((event, index) => {
    console.log(`  Event ${index}:`, event.args.commitment);
  });

  const commitments = depositEvents.map((event) => event.args.commitment);
  const foundIndex = commitments.findIndex((c) => c === commitment);

  if (foundIndex >= 0) {
    console.log("✅ Commitment found at index:", foundIndex);
  } else {
    console.log("❌ Commitment not found!");
  }

  // 7. Output frontend test instructions
  console.log("\n📋 Frontend Test Instructions:");
  console.log("1. Start Hardhat network: npx hardhat node");
  console.log(
    "2. In another terminal, start frontend: cd frontend && npm run dev"
  );
  console.log("3. Connect MetaMask to localhost:8545");
  console.log("4. Import this account to MetaMask:");
  console.log("   Address:", deployer.address);
  console.log("   Private key: (check Hardhat node output)");
  console.log("5. Test deposit with secret:", secretNote);
  console.log("6. Test withdrawal with the same secret");

  console.log("\n🎉 Deployment and setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
