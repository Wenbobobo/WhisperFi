const { ethers } = require("ethers");
const {
  getPendingIntents,
  updateIntentWithTxHash,
  updateIntentStatus,
  incrementRetryCount,
} = require("./database");
const { UniswapEncoder } = require("./uniswap");
const { createFlashbotsProvider } = require("./flashbots");
const { buildPoseidon } = require("circomlibjs");

// Retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 30000, // 30 seconds
};

/**
 * Enhanced Intent Processor class.
 * Supports trade encoding and Flashbots integration.
 */
class IntentProcessor {
  constructor(privacyPool, provider, options = {}) {
    this.privacyPool = privacyPool;
    this.provider = provider;
    this.isProcessing = false;
    this.processingInterval = null;
    this.config = options; // Save configuration
    this.poseidon = null; // Initialize as null, will be initialized in async function

    // Create Flashbots authentication signer
    this.flashbotsSigner = this.createFlashbotsSigner(options.flashbotsKey);

    // Initialize Uniswap encoder
    this.uniswapEncoder = new UniswapEncoder(provider, options.chainId || 1);

    // Initialize Flashbots provider
    this.flashbotsProvider = createFlashbotsProvider(
      provider,
      this.flashbotsSigner,
      options.flashbots || {}
    );

    // Force disable Flashbots based on configuration
    if (this.config.testing) {
      this.flashbotsProvider.updateOptions({ enabled: false });
    } else if (provider.constructor.name === "HardhatEthersProvider") {
      this.flashbotsProvider.updateOptions({ enabled: false });
    }

    // Asynchronously initialize Poseidon
    this.initializePoseidon();
  }

  /**
   * Asynchronously initializes the Poseidon hasher.
   */
  async initializePoseidon() {
    try {
      this.poseidon = await buildPoseidon();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Ensures Poseidon is initialized.
   */
  async ensurePoseidonReady() {
    if (!this.poseidon) {
      await this.initializePoseidon();
    }
  }

  /**
   * Converts Poseidon result to BigInt.
   */
  poseidonResultToBigInt(hash) {
    if (typeof hash === "bigint") {
      return hash;
    }

    // If it's a byte array (Uint8Array or Array)
    if (Array.isArray(hash) || hash instanceof Uint8Array) {
      const bytes = Array.from(hash);
      const hexString =
        "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
      return BigInt(hexString);
    }

    // If hash is F1Field object or has toString method
    if (hash && typeof hash.toString === "function") {
      const str = hash.toString();
      if (str.startsWith("0x")) {
        return BigInt(str);
      }
      return BigInt(str);
    }

    return BigInt(hash);
  }

  /**
   * Simulates the simplified Poseidon implementation in the contract (for compatibility).
   */
  simplifiedPoseidon(input) {
    const FIELD_SIZE =
      21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const C0 =
      0x109b7f411ba0e4c9b2b70caf5c36a7b194be7c11ad24378bfedb68592ba8118bn;
    const C1 =
      0x16ed41e13bb9c0c66ae119424fddbcbc9314dc9fdbdeea55d6c64543dc4903e0n;
    const C2 =
      0x2b90bba00fca0589f617e7dcbfe82e0df706ab640ceb247b791a93b74e36736dn;

    // Modular exponentiation
    function powMod(base, exp, mod) {
      let result = 1n;
      base = base % mod;
      while (exp > 0n) {
        if (exp % 2n === 1n) {
          result = (result * base) % mod;
        }
        exp = exp >> 1n;
        base = (base * base) % mod;
      }
      return result;
    }

    let x = BigInt(input[0]);
    let y = BigInt(input[1]);

    // First round: add constants
    x = (x + C0) % FIELD_SIZE;
    y = (y + C1) % FIELD_SIZE;

    // S-box (x^5)
    x = powMod(x, 5n, FIELD_SIZE);
    y = powMod(y, 5n, FIELD_SIZE);

    // Linear layer (simplified MDS matrix)
    let t0 = (x + y) % FIELD_SIZE;
    let t1 = (x * 2n + y) % FIELD_SIZE;

    // Second round
    t0 = (t0 + C2) % FIELD_SIZE;
    t1 = (t1 + C0) % FIELD_SIZE;

    // Final S-box
    t0 = powMod(t0, 5n, FIELD_SIZE);
    t1 = powMod(t1, 5n, FIELD_SIZE);

    // Final linear layer
    return (t0 + t1) % FIELD_SIZE;
  }

  /**
   * Generates trade data hash (using simplified implementation matching the contract).
   */
  generateTradeDataHash(recipient, amount) {
    // Convert address to uint256(uint160(address)), fully consistent with contract logic
    const addressBigInt = BigInt(recipient);
    const uint160Max = (1n << 160n) - 1n; // 2^160 - 1
    const recipientAsUint160 = addressBigInt & uint160Max; // Ensure within uint160 range
    const recipientAsUint256 = recipientAsUint160; // Extend to uint256 (actually just uint160 value)

    const hash = this.simplifiedPoseidon([
      recipientAsUint256,
      BigInt(amount.toString()),
    ]);
    const result = ethers.toBeHex(hash, 32);

    return result;
  }

  /**
   * Creates a Flashbots authentication signer.
   * @param {string} privateKey - The private key (optional).
   * @returns {ethers.Wallet} The signer.
   */
  createFlashbotsSigner(privateKey) {
    if (privateKey) {
      return new ethers.Wallet(privateKey, this.provider);
    }

    // If no private key is provided, generate a temporary one
    const randomWallet = ethers.Wallet.createRandom();
    return randomWallet.connect(this.provider);
  }

  /**
   * Starts the automatic processor.
   * @param {number} intervalMs - The processing interval in milliseconds.
   */
  start(intervalMs = 30000) {
    if (this.processingInterval) {
      return;
    }

    // Execute once immediately
    this.processPendingIntents();

    // Set up interval processing
    this.processingInterval = setInterval(() => {
      this.processPendingIntents();
    }, intervalMs);
  }

  /**
   * Stops the automatic processor.
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Processes all pending intents.
   * @returns {Promise<Object>} Processing result statistics.
   */
  async processPendingIntents() {
    if (this.isProcessing) {
      return { status: "skipped", reason: "already_processing" };
    }

    this.isProcessing = true;
    let stats = {
      total: 0,
      success: 0,
      failed: 0,
      retried: 0,
      skipped: 0,
    };

    try {
      const pendingIntents = await getPendingIntents();
      stats.total = pendingIntents.length;

      if (pendingIntents.length === 0) {
        return { status: "completed", stats };
      }

      // Process all intents in parallel
      const processingPromises = pendingIntents.map((intent) =>
        this.processSingleIntent(intent).catch((error) => {
          return { failed: true }; // Ensure Promise.all doesn't reject on a single failure
        })
      );

      // Wait for all intents to be processed
      const results = await Promise.all(processingPromises);

      // Tally the results
      results.forEach((result) => {
        if (result.success) stats.success++;
        else if (result.retried) stats.retried++;
        else if (result.failed) stats.failed++;
        else stats.skipped++;
      });

      return { status: "completed", stats };
    } catch (error) {
      return { status: "error", error: error.message, stats };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes a single intent.
   * @param {Object} intent - The intent object.
   * @returns {Promise<Object>} The processing result.
   */
  async processSingleIntent(intent) {
    const { id, intent_data, retry_count } = intent;

    // Check if retry limit is exceeded
    if (retry_count >= RETRY_CONFIG.MAX_RETRIES) {
      await updateIntentStatus(id, "failed");
      return { failed: true, reason: "max_retries_exceeded" };
    }

    try {
      const parsedIntentData = JSON.parse(intent_data);
      // Parse intent data to determine how to process
      const processedResult = await this.processIntentData(parsedIntentData);

      if (processedResult.success) {
        // Update status to submitted and record transaction hash
        await updateIntentWithTxHash(id, "submitted", processedResult.txHash);

        // Wait for transaction confirmation
        await this.monitorTransaction(id, processedResult.txHash);

        return { success: true, txHash: processedResult.txHash };
      } else {
        // On failure, increment retry count
        await incrementRetryCount(id);

        return { retried: true, error: processedResult.error };
      }
    } catch (error) {
      // Increment retry count on exception
      await incrementRetryCount(id);

      return { retried: true, error: error.message };
    }
  }

  /**
   * Processes intent data, supporting multiple intent types.
   * @param {Object} intentData - The intent data.
   * @returns {Promise<Object>} The processing result.
   */
  async processIntentData(intentData) {
    // Check intent type
    if (this.isTradeIntent(intentData)) {
      // Process trade intent (requires encoding)
      return await this.processTradeIntent(intentData);
    } else if (this.isEncodedIntent(intentData)) {
      // Process encoded intent (direct execution)
      return await this.processEncodedIntent(intentData);
    } else {
      throw new Error("Unknown intent type");
    }
  }

  /**
   * Checks if it is a trade intent.
   * @param {Object} intentData - The intent data.
   * @returns {boolean} True if it is a trade intent.
   */
  isTradeIntent(intentData) {
    return (
      intentData.tradeIntent &&
      intentData.tradeIntent.tokenIn &&
      intentData.tradeIntent.tokenOut
    );
  }

  /**
   * Checks if it is an encoded intent.
   * @param {Object} intentData - The intent data.
   * @returns {boolean} True if it is an encoded intent.
   */
  isEncodedIntent(intentData) {
    return intentData.pA && intentData.pB && intentData.pC && intentData.target;
  }

  /**
   * Processes a trade intent (requires encoding first).
   * @param {Object} intentData - The intent data.
   * @returns {Promise<Object>} The processing result.
   */
  async processTradeIntent(intentData) {
    try {
      // Ensure Poseidon is initialized
      await this.ensurePoseidonReady();

      // 1. Prepare complete trade data (including recipient)
      const completeTradeData = {
        ...intentData.tradeIntent,
        recipient: intentData.recipient || this.privacyPool.target,
      };

      // 2. Validate the trade intent
      this.uniswapEncoder.validateTradeIntent(completeTradeData);

      // 3. Encode the Uniswap trade
      const encodedTrade = await this.uniswapEncoder.encodeTrade(
        completeTradeData
      );

      // 4. Recalculate tradeDataHash to ensure consistency
      const tradeAmountBigInt = ethers.parseUnits(
        completeTradeData.amountIn.toString(),
        0
      );
      const recalculatedTradeDataHash = this.generateTradeDataHash(
        completeTradeData.recipient,
        tradeAmountBigInt
      );

      // 5. Construct full PrivacyPool transaction data
      const fullIntentData = {
        ...intentData,
        target: encodedTrade.target,
        callData: encodedTrade.calldata,
        value: encodedTrade.value || "0",
        // Retain original ZK proof data
        pA: intentData.pA,
        pB: intentData.pB,
        pC: intentData.pC,
        proofRoot: intentData.proofRoot,
        nullifier: intentData.nullifier,
        newCommitment: intentData.newCommitment,
        // Use the recalculated hash
        tradeDataHash: recalculatedTradeDataHash,
        // Add fields required for trade execution - ensure correct types
        tradeAmount: tradeAmountBigInt,
        recipient: completeTradeData.recipient,
      };

      // 6. Execute the encoded transaction
      return await this.executeTransactionWithFlashbots(fullIntentData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Processes an encoded intent.
   * @param {Object} intentData - The intent data.
   * @returns {Promise<Object>} The processing result.
   */
  async processEncodedIntent(intentData) {
    return await this.executeTransactionWithFlashbots(intentData);
  }

  /**
   * Executes a transaction using Flashbots.
   * @param {Object} intentData - The intent data.
   * @returns {Promise<Object>} The execution result.
   */
  async executeTransactionWithFlashbots(intentData) {
    try {
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
      } = intentData;

      // Validate required fields
      if (
        !pA ||
        !pB ||
        !pC ||
        !proofRoot ||
        !nullifier ||
        !newCommitment ||
        !tradeDataHash ||
        !target
      ) {
        return {
          success: false,
          error: "Missing required transaction parameters.",
        };
      }

      // 1. Build PrivacyPool transaction - using the new trade function
      // Extract trade-related parameters
      const { tradeAmount, recipient } = intentData;

      if (!tradeAmount || !recipient) {
        return {
          success: false,
          error: "Missing trade amount or recipient address.",
        };
      }

      const privacyPoolTx = {
        to: this.privacyPool.target,
        data: this.privacyPool.interface.encodeFunctionData("trade", [
          pA, // _pA
          pB, // _pB
          pC, // _pC
          proofRoot, // _merkleRoot
          nullifier, // _nullifier
          newCommitment, // _newCommitment
          tradeAmount, // _tradeAmount
          recipient, // _recipient
          intentData.tradeDataHash, // Ensure using the hash from intentData
          target, // _target
          callData, // _callData
        ]),
        value: "0", // trade function is not payable
        gasLimit: ethers.parseUnits("500000", "wei"), // Set a high gas limit
      };

      // 2. Get target block number
      const targetBlockNumber =
        await this.flashbotsProvider.getTargetBlockNumber(1);

      // 3. Send the bundle
      const result = await this.flashbotsProvider.sendBundle(
        [privacyPoolTx],
        targetBlockNumber
      );

      if (result.success) {
        return {
          success: true,
          txHash: result.txHash || result.bundleHash,
          method: result.method,
        };
      } else {
        return { success: false, error: "Bundle submission failed." };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Monitors the transaction status.
   * @param {string} intentId - The intent ID.
   * @param {string} txHash - The transaction hash.
   */
  async monitorTransaction(intentId, txHash) {
    try {
      // Use waitForTransaction to wait for confirmation
      const receipt = await this.provider.waitForTransaction(txHash);

      if (receipt && receipt.status === 1) {
        await updateIntentStatus(intentId, "confirmed");
      } else {
        await updateIntentStatus(intentId, "failed");
      }
    } catch (error) {
      // On failure to monitor, keep the 'submitted' status
    }
  }

  /**
   * Gets a trade quote (for frontend display).
   * @param {Object} tradeIntent - The trade intent.
   * @returns {Promise<Object>} The quote information.
   */
  async getTradeQuote(tradeIntent) {
    try {
      this.uniswapEncoder.validateTradeIntent(tradeIntent, false);
      const quote = await this.uniswapEncoder.getQuote(
        tradeIntent.tokenIn,
        tradeIntent.tokenOut,
        tradeIntent.amountIn
      );

      return {
        success: true,
        quote: quote,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Gets the processor status.
   * @returns {Object} The processor status information.
   */
  getStatus() {
    return {
      isRunning: !!this.processingInterval,
      isProcessing: this.isProcessing,
      config: RETRY_CONFIG,
      uniswap: {
        supportedTokens: this.uniswapEncoder.getSupportedTokens(),
      },
      flashbots: this.flashbotsProvider.getStatus(),
    };
  }

  /**
   * Updates the Flashbots configuration.
   * @param {Object} newOptions - The new configuration options.
   */
  updateFlashbotsConfig(newOptions) {
    this.flashbotsProvider.updateOptions(newOptions);
  }
}

module.exports = IntentProcessor;
