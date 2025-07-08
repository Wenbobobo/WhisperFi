require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require("express");
const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// --- Ethers Setup ---

// 1. Connect to the local Hardhat network
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

// 2. Load the contract ABI
const abiPath = path.join(__dirname, '../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json');
const contractArtifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
const privacyPoolAbi = contractArtifact.abi;

// 3. Get the contract address (replace with your actual deployed address)
// You can get this address after running `npx hardhat run scripts/deploy.js --network localhost`
const privacyPoolAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

// 4. Create a contract instance
// We need a signer to send transactions, for now we'll get the first Hardhat account
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider); // Make sure to set a PRIVATE_KEY env variable
const privacyPool = new ethers.Contract(privacyPoolAddress, privacyPoolAbi, signer);

console.log(`Connected to PrivacyPool at address: ${privacyPoolAddress}`);

// --- Express Server ---

app.use(express.json());

app.post("/relay/trade", async (req, res) => {
  const { pA, pB, pC, proofRoot, nullifier, newCommitment, tradeDataHash, executor, target, callData } = req.body;

  console.log("Received trade request:", req.body);

  try {
    // Validate inputs (basic validation)
    if (!pA || !pB || !pC || !proofRoot || !nullifier || !newCommitment || !tradeDataHash || !executor || !target) {
      return res.status(400).json({ error: "Missing required fields for trade." });
    }

    // Interact with the PrivacyPool contract
    const tx = await privacyPool.trade(
      pA,
      pB,
      pC,
      proofRoot,
      nullifier,
      newCommitment,
      tradeDataHash,
      executor,
      target,
      callData || "0x"
    );

    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`Transaction confirmed: ${tx.hash}`);

    res.json({ status: "success", txHash: tx.hash });

  } catch (error) {
    console.error("Error relaying trade:", error);
    res.status(500).json({ error: "Failed to relay trade.", details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Relayer listening at http://localhost:${port}`);
});
