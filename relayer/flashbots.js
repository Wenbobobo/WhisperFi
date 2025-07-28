const { ethers } = require("ethers");

/**
 * Flashbots abstraction layer.
 * Provides MEV-protected transaction sending with multiple implementation options.
 */
class FlashbotsProvider {
  constructor(provider, authSigner, options = {}) {
    this.provider = provider;
    this.authSigner = authSigner;
    this.options = {
      // Flashbots Relay URL (defaults to mainnet)
      relayUrl: options.relayUrl || "https://relay.flashbots.net",
      // Whether Flashbots is enabled (can be disabled for testing)
      enabled: options.enabled !== false,
      // Whether to use simulation mode (for local test networks)
      simulationMode: options.simulationMode || false,
      // Maximum number of retries
      maxRetries: options.maxRetries || 3,
      ...options,
    };
  }

  /**
   * Sends a bundle to Flashbots.
   * @param {Array} transactions - Array of transactions.
   * @param {number} targetBlockNumber - Target block number.
   * @returns {Promise<Object>} Bundle submission result.
   */
  async sendBundle(transactions, targetBlockNumber) {
    if (!this.options.enabled) {
      return await this.sendRegularTransaction(transactions[0]);
    }

    if (this.options.simulationMode) {
      return await this.sendRegularTransaction(transactions[0]);
    }

    try {
      // Build the bundle
      const bundle = await this.buildBundle(transactions, targetBlockNumber);

      // Try to use the actual Flashbots SDK
      if (this.hasFlashbotsSDK()) {
        return await this.sendFlashbotsBundle(bundle, targetBlockNumber);
      } else {
        // Fallback to direct HTTP call
        return await this.sendBundleViaHTTP(bundle, targetBlockNumber);
      }
    } catch (error) {
      // Fallback strategy: if Flashbots fails, use a regular transaction
      if (this.options.fallbackToRegular !== false) {
        return await this.sendRegularTransaction(transactions[0]);
      }

      throw error;
    }
  }

  /**
   * Builds a Flashbots bundle.
   * @param {Array} transactions - Array of transactions.
   * @param {number} targetBlockNumber - Target block number.
   * @returns {Promise<Object>} Bundle object.
   */
  async buildBundle(transactions, targetBlockNumber) {
    const bundle = {
      transactions: [],
      blockNumber: targetBlockNumber,
      minTimestamp: 0,
      maxTimestamp: 0,
    };

    for (const tx of transactions) {
      // Sign the transaction
      const signedTx = await this.authSigner.signTransaction(tx);
      bundle.transactions.push(signedTx);
    }

    return bundle;
  }

  /**
   * Checks if the Flashbots SDK is available.
   * @returns {boolean} True if available, false otherwise.
   */
  hasFlashbotsSDK() {
    try {
      // Attempt to dynamically import the Flashbots SDK
      require.resolve("@flashbots/ethers-provider-bundle");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sends a bundle using the Flashbots SDK.
   * @param {Object} bundle - Bundle object.
   * @param {number} targetBlockNumber - Target block number.
   * @returns {Promise<Object>} Send result.
   */
  async sendFlashbotsBundle(bundle, targetBlockNumber) {
    try {
      // Dynamically import the Flashbots SDK
      const {
        FlashbotsBundleProvider,
      } = require("@flashbots/ethers-provider-bundle");

      const flashbotsProvider = await FlashbotsBundleProvider.create(
        this.provider,
        this.authSigner,
        this.options.relayUrl
      );

      const bundleSubmission = await flashbotsProvider.sendBundle(
        bundle.transactions,
        targetBlockNumber
      );

      // Wait for the bundle to be included
      const result = await bundleSubmission.wait();

      if (result === 0) {
        return {
          success: true,
          bundleHash: bundleSubmission.bundleHash,
          blockNumber: targetBlockNumber,
          method: "flashbots-sdk",
        };
      } else {
        throw new Error(`Bundle not included, result code: ${result}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sends a bundle via a direct HTTP call to the Flashbots API.
   * @param {Object} bundle - The bundle object.
   * @param {number} targetBlockNumber - The target block number.
   * @returns {Promise<Object>} The submission result.
   */
  async sendBundleViaHTTP(bundle, targetBlockNumber) {
    try {
      // Construct the request body
      const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendBundle",
        params: [
          {
            txs: bundle.transactions,
            blockNumber: `0x${targetBlockNumber.toString(16)}`,
            minTimestamp: bundle.minTimestamp,
            maxTimestamp: bundle.maxTimestamp,
          },
        ],
      };

      // Create the signature
      const message = JSON.stringify(requestBody);
      const signature = await this.authSigner.signMessage(message);

      // Send the HTTP request
      const response = await fetch(this.options.relayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Flashbots-Signature": `${this.authSigner.address}:${signature}`,
        },
        body: message,
      });

      if (!response.ok) {
        throw new Error(`HTTP request failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Flashbots API error: ${result.error.message}`);
      }

      return {
        success: true,
        bundleHash: result.result?.bundleHash || "unknown",
        blockNumber: targetBlockNumber,
        method: "flashbots-http",
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sends a regular transaction (fallback mechanism).
   * @param {Object} transaction - The transaction object.
   * @returns {Promise<Object>} The transaction result.
   */
  async sendRegularTransaction(transaction) {
    try {
      // Estimate gas
      const gasEstimate = await this.provider.estimateGas(transaction);
      transaction.gasLimit = gasEstimate;

      // Get gas price
      const feeData = await this.provider.getFeeData();
      transaction.maxFeePerGas = feeData.maxFeePerGas;
      transaction.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      // Send the transaction
      const tx = await this.authSigner.sendTransaction(transaction);

      return {
        success: true,
        txHash: tx.hash,
        method: "regular",
        transaction: tx,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Simulates a bundle execution (for validation).
   * @param {Array} transactions - An array of transactions.
   * @param {number} blockNumber - The block number for the simulation.
   * @returns {Promise<Object>} The simulation result.
   */
  async simulateBundle(transactions, blockNumber) {
    try {
      const results = [];

      for (const tx of transactions) {
        try {
          // Simulate execution using callStatic
          const result = await this.provider.call(tx, blockNumber);
          results.push({
            success: true,
            result: result,
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: results.every((r) => r.success),
        results: results,
        blockNumber: blockNumber,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets the current block number.
   * @returns {Promise<number>} The current block number.
   */
  async getCurrentBlockNumber() {
    return await this.provider.getBlockNumber();
  }

  /**
   * Calculates the target block number (current block + offset).
   * @param {number} [offset=1] - The block offset.
   * @returns {Promise<number>} The target block number.
   */
  async getTargetBlockNumber(offset = 1) {
    const current = await this.getCurrentBlockNumber();
    return current + offset;
  }

  /**
   * Gets the status information of the provider.
   * @returns {Object} The status information.
   */
  getStatus() {
    return {
      enabled: this.options.enabled,
      simulationMode: this.options.simulationMode,
      relayUrl: this.options.relayUrl,
      hasSDK: this.hasFlashbotsSDK(),
      authSigner: this.authSigner.address,
    };
  }

  /**
   * Updates the configuration options.
   * @param {Object} newOptions - The new configuration options.
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * Factory function to create a FlashbotsProvider instance.
 * @param {Object} provider - The Ethers provider.
 * @param {Object} authSigner - The authentication signer.
 * @param {Object} options - Configuration options.
 * @returns {FlashbotsProvider} A FlashbotsProvider instance.
 */
function createFlashbotsProvider(provider, authSigner, options = {}) {
  // Automatically adjust configuration based on the network
  const networkName = provider.network?.name || "unknown";
  let baseOptions = {};

  if (networkName === "localhost" || networkName === "hardhat") {
    // Configuration for local test networks
    baseOptions = {
      enabled: false,
      simulationMode: true,
      fallbackToRegular: true,
    };
  } else if (networkName === "goerli" || networkName === "sepolia") {
    // Configuration for test networks
    baseOptions = {
      relayUrl: "https://relay-goerli.flashbots.net",
    };
  }

  // Merge base options with user-provided options, allowing overrides
  const finalOptions = { ...baseOptions, ...options };

  return new FlashbotsProvider(provider, authSigner, finalOptions);
}

module.exports = {
  FlashbotsProvider,
  createFlashbotsProvider,
};
