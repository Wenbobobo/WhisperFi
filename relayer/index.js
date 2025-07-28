require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

const express = require("express");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const {
  setupDatabase,
  createIntent,
  getIntentById,
  updateIntentStatus,
  generateIntentId,
} = require("./database");
const IntentProcessor = require("./processor");

const app = express();
const port = 3000;

// --- Ethers Setup ---

// 1. Connect to the local Hardhat network
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

// 2. Load the contract ABI
const abiPath = path.join(
  __dirname,
  "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json"
);
const contractArtifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));
const privacyPoolAbi = contractArtifact.abi;

// 3. Get the contract address (replace with your actual deployed address)
// You can get this address after running `npx hardhat run scripts/deploy.js --network localhost`
const privacyPoolAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

// 4. Create a contract instance
// We need a signer to send transactions, for now we'll get the first Hardhat account
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider); // Make sure to set a PRIVATE_KEY env variable
const privacyPool = new ethers.Contract(
  privacyPoolAddress,
  privacyPoolAbi,
  signer
);

// Create an enhanced intent processor instance
const intentProcessor = new IntentProcessor(privacyPool, provider, {
  chainId: 1, // Mainnet chain ID, adjustable for testing
  flashbotsKey: process.env.FLASHBOTS_PRIVATE_KEY, // Optional Flashbots private key
  flashbots: {
    enabled: process.env.FLASHBOTS_ENABLED !== "false", // Enabled by default
    simulationMode: process.env.NODE_ENV === "development", // Use simulation mode in development
    fallbackToRegular: true, // Allow fallback to regular transactions
  },
});

// --- Express Server ---

app.use(express.json());

/**
 * @api {post} /intent/trade Submit a trade intent
 * @apiName PostTradeIntent
 * @apiGroup Intent
 *
 * @apiBody {Object} proofData ZK proof data.
 * @apiBody {String} executor The executor address.
 * @apiBody {String} target The target contract address.
 * @apiBody {String} [callData] The call data for the target contract.
 *
 * @apiSuccess {String} status The status of the intent.
 * @apiSuccess {String} intentId The ID of the created intent.
 * @apiSuccess {String} message A confirmation message.
 */
app.post("/intent/trade", async (req, res) => {
  const {
    pA,
    pB,
    pC,
    proofRoot,
    nullifier,
    newCommitment,
    tradeDataHash,
    executor,
    target,
    callData,
  } = req.body;

  try {
    // Basic input validation
    if (
      !pA ||
      !pB ||
      !pC ||
      !proofRoot ||
      !nullifier ||
      !newCommitment ||
      !tradeDataHash ||
      !executor ||
      !target
    ) {
      return res
        .status(400)
        .json({ error: "Missing required fields for trade intent." });
    }

    // Generate a unique intent ID
    const intentId = generateIntentId();

    // Store the trade intent in the database
    await createIntent(intentId, {
      pA,
      pB,
      pC,
      proofRoot,
      nullifier,
      newCommitment,
      tradeDataHash,
      executor,
      target,
      callData: callData || "0x",
    });

    // Return the intent ID and status
    res.json({
      status: "pending",
      intentId: intentId,
      message: "Trade intent received and is being processed.",
    });
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to create trade intent.",
        details: error.message,
      });
  }
});

/**
 * @api {post} /relay/trade Direct trade relay (legacy)
 * @apiName RelayTrade
 * @apiGroup Relayer
 * @apiDescription Kept for backward compatibility.
 *
 * @apiBody {Object} proofData ZK proof data.
 * @apiBody {String} executor The executor address.
 * @apiBody {String} target The target contract address.
 *
 * @apiSuccess {String} status The status of the transaction.
 * @apiSuccess {String} txHash The transaction hash.
 */
app.post("/relay/trade", async (req, res) => {
  const {
    pA,
    pB,
    pC,
    proofRoot,
    nullifier,
    newCommitment,
    tradeDataHash,
    executor,
    target,
    callData,
  } = req.body;

  try {
    // Basic input validation
    if (
      !pA ||
      !pB ||
      !pC ||
      !proofRoot ||
      !nullifier ||
      !newCommitment ||
      !tradeDataHash ||
      !executor ||
      !target
    ) {
      return res
        .status(400)
        .json({ error: "Missing required fields for trade." });
    }

    // Interact directly with the PrivacyPool contract using the withdraw function
    const tx = await privacyPool.withdraw(
      pA,
      pB,
      pC,
      proofRoot,
      nullifier,
      executor, // _recipient
      "0", // _fee (set to 0, no fee)
      signer.address // _relayer
    );

    await tx.wait();

    res.json({ status: "success", txHash: tx.hash });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Trade execution failed.", details: error.message });
  }
});

/**
 * @api {post} /intent/trade-swap Submit a Uniswap trade intent
 * @apiName PostTradeSwapIntent
 * @apiGroup Intent
 *
 * @apiBody {Object} proofData ZK proof data.
 * @apiBody {Object} tradeIntent Details of the swap.
 * @apiBody {String} [recipient] The final recipient of the swapped tokens.
 *
 * @apiSuccess {String} status The status of the intent.
 * @apiSuccess {String} intentId The ID of the created intent.
 * @apiSuccess {String} message A confirmation message.
 */
app.post("/intent/trade-swap", async (req, res) => {
  const {
    pA,
    pB,
    pC,
    proofRoot,
    nullifier,
    newCommitment,
    tradeDataHash,
    tradeIntent,
    recipient,
  } = req.body;

  try {
    // Validate required ZK proof fields
    if (
      !pA ||
      !pB ||
      !pC ||
      !proofRoot ||
      !nullifier ||
      !newCommitment ||
      !tradeDataHash
    ) {
      return res
        .status(400)
        .json({ error: "Missing required ZK proof fields." });
    }

    // Validate trade intent fields
    if (
      !tradeIntent ||
      !tradeIntent.tokenIn ||
      !tradeIntent.tokenOut ||
      !tradeIntent.amountIn
    ) {
      return res
        .status(400)
        .json({ error: "Missing required trade intent fields." });
    }

    // Generate a unique intent ID
    const intentId = generateIntentId();

    // Store the trade intent in the database
    await createIntent(intentId, {
      // ZK proof data
      pA,
      pB,
      pC,
      proofRoot,
      nullifier,
      newCommitment,
      tradeDataHash,
      // Trade intent data
      tradeIntent: tradeIntent,
      recipient: recipient || privacyPoolAddress,
      // Mark as a trade-swap intent type
      intentType: "trade-swap",
    });

    res.json({
      status: "pending",
      intentId: intentId,
      message: "Uniswap trade intent received and is being processed.",
    });
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Failed to create Uniswap trade intent.",
        details: error.message,
      });
  }
});

/**
 * @api {post} /trade/quote Get a trade quote
 * @apiName GetTradeQuote
 * @apiGroup Trade
 *
 * @apiBody {String} tokenIn The input token address.
 * @apiBody {String} tokenOut The output token address.
 * @apiBody {String} amountIn The amount of the input token.
 *
 * @apiSuccess {Boolean} success Indicates if the quote was successful.
 * @apiSuccess {Object} quote The trade quote details.
 * @apiSuccess {String} timestamp The timestamp of the quote.
 */
app.post("/trade/quote", async (req, res) => {
  const { tokenIn, tokenOut, amountIn } = req.body;

  try {
    if (!tokenIn || !tokenOut || !amountIn) {
      return res
        .status(400)
        .json({ error: "Missing required fields for quote request." });
    }

    const quoteResult = await intentProcessor.getTradeQuote({
      tokenIn,
      tokenOut,
      amountIn,
    });

    if (quoteResult.success) {
      res.json({
        success: true,
        quote: quoteResult.quote,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        error: "Failed to get quote.",
        details: quoteResult.error,
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to get trade quote.", details: error.message });
  }
});

/**
 * @api {get} /intent/status/:intentId Get intent status
 * @apiName GetIntentStatus
 * @apiGroup Intent
 *
 * @apiParam {String} intentId The ID of the intent.
 *
 * @apiSuccess {Object} intent The full intent status object.
 */
app.get("/intent/status/:intentId", async (req, res) => {
  const { intentId } = req.params;

  try {
    // Query the intent record from the database
    const intent = await getIntentById(intentId);

    if (!intent) {
      return res.status(404).json({
        error: "Trade intent not found.",
        intentId: intentId,
      });
    }

    // Return the complete intent status information
    res.json({
      intentId: intent.id,
      status: intent.status,
      tx_hash: intent.tx_hash,
      retry_count: intent.retry_count,
      created_at: intent.created_at,
      updated_at: intent.updated_at,
      intent_data: intent.intent_data,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to query intent status.",
      details: error.message,
    });
  }
});

/**
 * @api {post} /intent/process Manually trigger intent processing
 * @apiName ProcessIntents
 * @apiGroup Intent
 *
 * @apiSuccess {String} message A confirmation message.
 * @apiSuccess {Object} result The result of the processing.
 */
app.post("/intent/process", async (req, res) => {
  try {
    const result = await intentProcessor.processIntents();
    res.json({
      message: "Intent processing finished.",
      result: result,
    });
  } catch (error) {
    res.status(500).json({
      error: "Manual intent processing failed.",
      details: error.message,
    });
  }
});

/**
 * @api {get} /processor/status Get processor status
 * @apiName GetProcessorStatus
 * @apiGroup Processor
 *
 * @apiSuccess {Object} processor_status The current status of the intent processor.
 * @apiSuccess {String} timestamp The timestamp of the status check.
 */
app.get("/processor/status", (req, res) => {
  const status = intentProcessor.getStatus();
  res.json({
    processor_status: status,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @api {post} /processor/start Start the intent processor
 * @apiName StartProcessor
 * @apiGroup Processor
 *
 * @apiBody {Number} [interval] The processing interval in milliseconds.
 *
 * @apiSuccess {String} message A confirmation message.
 * @apiSuccess {Number} interval The active processing interval.
 */
app.post("/processor/start", (req, res) => {
  const { interval } = req.body; // Optional processing interval
  try {
    intentProcessor.start(interval);
    res.json({
      message: "Intent processor started.",
      interval: interval || 30000,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to start processor.",
      details: error.message,
    });
  }
});

/**
 * @api {post} /processor/stop Stop the intent processor
 * @apiName StopProcessor
 * @apiGroup Processor
 *
 * @apiSuccess {String} message A confirmation message.
 */
app.post("/processor/stop", (req, res) => {
  try {
    intentProcessor.stop();
    res.json({
      message: "Intent processor stopped.",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to stop processor.",
      details: error.message,
    });
  }
});

// --- Server Startup ---

/**
 * Initializes the database and starts the Express server.
 */
async function startServer() {
  try {
    // Initialize the database
    await setupDatabase();

    // Start the Express server
    app.listen(port, () => {
      // Automatically start the processor (30-second interval)
      intentProcessor.start(30000);
    });
  } catch (error) {
    process.exit(1);
  }
}

/**
 * Handles graceful shutdown.
 */
function gracefulShutdown() {
  intentProcessor.stop();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Start the server
startServer();
