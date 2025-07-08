// scripts/e2e-test.js
const { ethers } = require("ethers");
const axios = require("axios");
const fs = require('fs');
const path = require('path');

// Helper function to generate a mock proof (same as in our tests)
const generateMockProof = () => {
  const pA = ["0", "0"];
  const pB = [["0", "0"], ["0", "0"]];
  const pC = ["0", "0"];
  return [pA, pB, pC];
};

async function main() {
  // --- Setup ---
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

  const abiPath = path.join(__dirname, '../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json');
  const contractArtifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const privacyPoolAbi = contractArtifact.abi;
  const privacyPoolAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const privacyPool = new ethers.Contract(privacyPoolAddress, privacyPoolAbi, signer);

  const executorAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  console.log("E2E Test Started...");

  // --- 1. Deposit --- 
  console.log("Step 1: Depositing into the pool...");
  const commitment = ethers.randomBytes(32);
  const depositTx = await privacyPool.deposit(commitment, { value: ethers.parseEther("1") });
  await depositTx.wait();
  console.log(`Deposit successful. Commitment: ${ethers.hexlify(commitment)}`);

  const currentRoot = await privacyPool.root();
  console.log(`Current Merkle Root: ${currentRoot}`);

  // --- 2. Prepare Trade Request ---
  console.log("\nStep 2: Preparing trade request for the relayer...");
  const [pA, pB, pC] = generateMockProof();
  const tradeRequest = {
    pA,
    pB,
    pC,
    proofRoot: currentRoot, // root is already a hex string
    nullifier: ethers.hexlify(ethers.randomBytes(32)),
    newCommitment: ethers.hexlify(ethers.randomBytes(32)),
    tradeDataHash: ethers.hexlify(ethers.randomBytes(32)),
    executor: executorAddress,
    target: signer.address, // For simplicity, the target is the signer itself
    callData: "0x" // No actual call data for this test
  };

  // --- 3. Send Request to Relayer ---
  console.log("\nStep 3: Sending trade request to the relayer at http://localhost:3000/relay/trade");
  try {
    const response = await axios.post("http://localhost:3000/relay/trade", tradeRequest);
    console.log("Relayer response:", response.data);
    if (response.data.status === "success") {
      console.log(`\nE2E Test SUCCESS: Relayer successfully processed the trade. TxHash: ${response.data.txHash}`);
    } else {
      console.error("\nE2E Test FAILED: Relayer reported an error.", response.data);
    }
  } catch (error) {
    console.error("\nE2E Test FAILED: Could not connect to the relayer.");
    if (error.response) {
        console.error("Error data:", error.response.data);
    }
  }
}

main().catch(console.error);
