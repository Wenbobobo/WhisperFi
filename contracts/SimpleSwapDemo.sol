// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title SimpleSwapDemo
 * @notice A simplified swap contract for demo purposes
 * @dev This contract simulates a basic token swap without complex routing
 */
contract SimpleSwapDemo {
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    // Mock token prices (scaled by 1e18 for precision)
    mapping(address => uint256) public tokenPrices;
    
    // Mock token addresses for demo
    address public constant ETH_ADDRESS = 0x0000000000000000000000000000000000000000;
    address public constant USDC_ADDRESS = 0x1000000000000000000000000000000000000001;
    address public constant DAI_ADDRESS = 0x2000000000000000000000000000000000000002;
    address public constant WBTC_ADDRESS = 0x3000000000000000000000000000000000000003;

    constructor() {
        // Initialize mock prices (scaled by 1e18)
        tokenPrices[ETH_ADDRESS] = 2500 * 1e18;   // $2500
        tokenPrices[USDC_ADDRESS] = 1 * 1e18;     // $1
        tokenPrices[DAI_ADDRESS] = 1 * 1e18;      // $1  
        tokenPrices[WBTC_ADDRESS] = 65000 * 1e18; // $65000
    }

    /**
     * @notice Execute a demo swap transaction
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input tokens
     * @return amountOut Amount of output tokens
     */
    function swapDemo(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external payable returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "Cannot swap same token");
        require(amountIn > 0, "Amount must be greater than 0");
        
        // Calculate output amount based on mock prices
        uint256 priceIn = tokenPrices[tokenIn];
        uint256 priceOut = tokenPrices[tokenOut];
        
        require(priceIn > 0 && priceOut > 0, "Invalid token prices");
        
        // Simple price calculation: amountOut = (amountIn * priceIn) / priceOut
        amountOut = (amountIn * priceIn) / priceOut;
        
        // Apply 0.3% fee (similar to Uniswap V2)
        amountOut = (amountOut * 997) / 1000;
        
        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            block.timestamp
        );
        
        return amountOut;
    }

    /**
     * @notice Update token price for demo purposes
     * @param token Token address
     * @param price New price (scaled by 1e18)
     */
    function updateTokenPrice(address token, uint256 price) external {
        tokenPrices[token] = price;
    }
    
    /**
     * @notice Get the expected output amount for a swap
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token  
     * @param amountIn Amount of input tokens
     * @return amountOut Expected output amount
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        uint256 priceIn = tokenPrices[tokenIn];
        uint256 priceOut = tokenPrices[tokenOut];
        
        if (priceIn == 0 || priceOut == 0) return 0;
        
        amountOut = (amountIn * priceIn) / priceOut;
        amountOut = (amountOut * 997) / 1000; // 0.3% fee
        
        return amountOut;
    }
}
