const { ethers } = require("ethers");
const { getNetworkConfig, getTokenConfig } = require("./config");

/**
 * Environment-aware Uniswap trade encoder.
 * Uses pure ethers implementation to avoid complex SDK dependency conflicts.
 * Focuses on the core function: encoding a trade intent into Uniswap V3 calldata.
 * Supports multi-network configuration, automatically selecting appropriate token addresses based on chainId.
 */
class UniswapEncoder {
  constructor(provider, chainId = 31337) {
    this.provider = provider;
    this.chainId = chainId;

    // Environment-aware configuration
    try {
      this.networkConfig = getNetworkConfig(chainId);
      this.SWAP_ROUTER_ADDRESS = this.networkConfig.uniswap.routerAddress;
    } catch (error) {
      // Fallback to a safe default configuration
      this.networkConfig = null;
      this.SWAP_ROUTER_ADDRESS = "0x0000000000000000000000000000000000000000"; // Placeholder
    }

    // Initialize custom token storage
    this.customTokens = {};

    // Uniswap V3 SwapRouter02 interface
    this.swapRouterInterface = new ethers.Interface([
      "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
      "function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)",
      "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)",
    ]);
  }

  /**
   * Encodes a trade intent into a specific Uniswap transaction.
   * @param {Object} tradeIntent - The trade intent.
   * @param {string} tradeIntent.tokenIn - The input token symbol.
   * @param {string} tradeIntent.tokenOut - The output token symbol.
   * @param {string} tradeIntent.amountIn - The input amount in wei as a string.
   * @param {string} tradeIntent.recipient - The recipient address.
   * @param {string} [tradeIntent.slippage="0.5"] - The slippage tolerance (e.g., "0.5" for 0.5%).
   * @returns {Promise<Object>} The encoded result.
   */
  async encodeTrade(tradeIntent) {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      recipient,
      slippage = "0.5",
    } = tradeIntent;

    try {
      // 1. Validate the trade intent
      this.validateTradeIntent(tradeIntent);

      // 2. Get token information
      const inputToken = this.getToken(tokenIn);
      const outputToken = this.getToken(tokenOut);

      // 3. Construct transaction parameters
      const params = {
        tokenIn: inputToken.address,
        tokenOut: outputToken.address,
        fee: 3000, // 0.3% fee pool (most common)
        recipient: recipient,
        deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
        amountIn: amountIn,
        amountOutMinimum: "0", // Simplified version, should be calculated based on slippage
        sqrtPriceLimitX96: "0", // No price limit
      };

      // 4. Encode the function call
      const calldata = this.swapRouterInterface.encodeFunctionData(
        "exactInputSingle",
        [params]
      );

      // 5. Determine if ETH needs to be sent
      const value = inputToken.symbol === "WETH" ? amountIn : "0";

      return {
        target: this.SWAP_ROUTER_ADDRESS,
        calldata: calldata,
        value: value,
        estimatedGas: "200000", // Simplified fixed estimate
        expectedOutput: "unknown", // Simplified version cannot calculate precisely
        route: `${inputToken.symbol} -> ${outputToken.symbol}`,
        impact: "unknown",
      };
    } catch (error) {
      throw new Error(`Trade encoding failed: ${error.message}`);
    }
  }

  /**
   * Gets token information - environment-aware version.
   * @param {string} tokenSymbol - The token symbol.
   * @returns {Object} The token information object.
   */
  getToken(tokenSymbol) {
    try {
      // Prioritize network-specific configuration
      if (this.networkConfig) {
        return getTokenConfig(this.chainId, tokenSymbol);
      }

      // Fallback to locally stored tokens if available
      if (this.customTokens && this.customTokens[tokenSymbol.toUpperCase()]) {
        return this.customTokens[tokenSymbol.toUpperCase()];
      }

      throw new Error(
        `Token ${tokenSymbol} is not available on network ${this.chainId}`
      );
    } catch (error) {
      // Provide a helpful error message
      const supportedTokens = this.networkConfig
        ? Object.keys(this.networkConfig.tokens).join(", ")
        : this.customTokens
        ? Object.keys(this.customTokens).join(", ")
        : "none";

      throw new Error(
        `Unsupported token: ${tokenSymbol}. Supported tokens on the current network (${this.chainId}): ${supportedTokens}`
      );
    }
  }

  /**
   * Gets a trade quote (simplified version).
   * @param {string} tokenIn - The input token symbol.
   * @param {string} tokenOut - The output token symbol.
   * @param {string} amountIn - The input amount.
   * @returns {Promise<Object>} The quote information.
   */
  async getQuote(tokenIn, tokenOut, amountIn) {
    try {
      const inputToken = this.getToken(tokenIn);
      const outputToken = this.getToken(tokenOut);

      // Simplified version: returns mock data
      // In a production environment, this should call the Quoter contract for a real quote
      return {
        inputAmount: amountIn,
        outputAmount: "unknown", // Simplified version cannot calculate real output
        priceImpact: "unknown",
        route: `${inputToken.symbol} -> ${outputToken.symbol}`,
        gasEstimate: "200000",
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates the format of a trade intent.
   * @param {Object} tradeIntent - The trade intent object.
   * @param {boolean} [requireRecipient=true] - Whether the recipient field is required.
   * @returns {boolean} True if valid.
   */
  validateTradeIntent(tradeIntent, requireRecipient = true) {
    const { tokenIn, tokenOut, amountIn, recipient } = tradeIntent;

    // Check for core required fields
    if (!tokenIn || !tokenOut || !amountIn) {
      throw new Error(
        "Missing required trade parameters: tokenIn, tokenOut, amountIn"
      );
    }

    // Check for recipient if required
    if (requireRecipient && !recipient) {
      throw new Error("Missing required trade parameter: recipient");
    }

    // Validate token support
    try {
      this.getToken(tokenIn);
      this.getToken(tokenOut);
    } catch (error) {
      throw new Error(`Unsupported token pair: ${tokenIn}/${tokenOut}`);
    }

    // Validate amount format (should be a string in wei)
    try {
      const amountBigInt = BigInt(amountIn);
      if (amountBigInt <= 0n) {
        throw new Error(
          `Invalid amount: ${amountIn} (should be a positive integer wei value)`
        );
      }
    } catch (error) {
      if (
        error.message.includes("Cannot convert") ||
        error.message.includes("invalid BigInt")
      ) {
        throw new Error(
          `Invalid amount format: ${amountIn} (should be a positive integer wei value)`
        );
      }
      throw error;
    }

    // Validate address format (only if recipient is required)
    if (requireRecipient && !ethers.isAddress(recipient)) {
      throw new Error(`Invalid recipient address: ${recipient}`);
    }

    // Validate that tokens are not the same
    if (tokenIn.toUpperCase() === tokenOut.toUpperCase()) {
      throw new Error(`Input and output tokens cannot be the same: ${tokenIn}`);
    }

    return true;
  }

  /**
   * Gets the list of supported tokens - environment-aware version.
   * @returns {Object} Supported token information.
   */
  getSupportedTokens() {
    if (this.networkConfig && this.networkConfig.tokens) {
      return { ...this.networkConfig.tokens };
    }

    // Fallback to custom tokens
    return { ...this.customTokens };
  }

  /**
   * Adds support for a custom token - environment-aware version.
   * @param {string} symbol - The token symbol.
   * @param {string} address - The token contract address.
   * @param {number} decimals - The number of decimals.
   * @param {string} name - The token name.
   */
  addCustomToken(symbol, address, decimals, name) {
    if (!ethers.isAddress(address)) {
      throw new Error(`Invalid token address: ${address}`);
    }

    // Ensure custom token storage is initialized
    if (!this.customTokens) {
      this.customTokens = {};
    }

    this.customTokens[symbol.toUpperCase()] = {
      symbol: symbol.toUpperCase(),
      address: address,
      decimals: decimals,
      name: name,
    };
  }

  /**
   * Converts a human-readable amount to wei.
   * @param {string} amount - The human-readable amount (e.g., "1.5").
   * @param {string} tokenSymbol - The token symbol.
   * @returns {string} The amount in wei as a string.
   */
  parseAmount(amount, tokenSymbol) {
    const token = this.getToken(tokenSymbol);
    return ethers.parseUnits(amount, token.decimals).toString();
  }

  /**
   * Converts a wei amount to a human-readable format.
   * @param {string} amountWei - The amount in wei.
   * @param {string} tokenSymbol - The token symbol.
   * @returns {string} The human-readable amount.
   */
  formatAmount(amountWei, tokenSymbol) {
    const token = this.getToken(tokenSymbol);
    return ethers.formatUnits(amountWei, token.decimals);
  }
}

module.exports = { UniswapEncoder };
