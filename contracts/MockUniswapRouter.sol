// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUniswapRouter
 * @notice Simplified Uniswap router for testing purposes
 * @dev Implements basic token swapping functionality for testing token trade verification
 */
contract MockUniswapRouter is Ownable {
    
    // Events for debugging
    event SwapCalled(address indexed caller, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event SwapFailed(address indexed caller, string reason);
    
    constructor() Ownable(msg.sender) {
        // Constructor now complies with new OpenZeppelin Ownable requirements
    }
    
    // Simplified swap parameter structure
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    // Simulated exchange rate mapping (tokenIn => tokenOut => rate)
    // rate represents how much tokenOut can be obtained for 1 tokenIn (considering decimal differences)
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    // Supported token pairs
    mapping(address => mapping(address => bool)) public supportedPairs;
    
    /**
     * @notice Sets the exchange rate for a token pair
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param rate Exchange rate (1 tokenIn = rate * tokenOut)
     */
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external onlyOwner {
        exchangeRates[tokenIn][tokenOut] = rate;
        supportedPairs[tokenIn][tokenOut] = true;
    }
    
    /**
     * @notice Executes a single exact input swap
     * @param params Swap parameters
     * @return amountOut Actual output amount
     */
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        try this._executeSwap(params) returns (uint256 result) {
            emit SwapCalled(msg.sender, params.tokenIn, params.tokenOut, params.amountIn, result);
            return result;
        } catch Error(string memory reason) {
            emit SwapFailed(msg.sender, reason);
            revert(reason);
        } catch {
            emit SwapFailed(msg.sender, "Unknown error");
            revert("Swap failed");
        }
    }
    
    function _executeSwap(ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        require(msg.sender == address(this), "Internal function");
        require(block.timestamp <= params.deadline, "Transaction too old");
        
        // 🔍 DEBUG: 详细的交易对诊断日志
        emit SwapCalled(tx.origin, params.tokenIn, params.tokenOut, params.amountIn, 0);
        
        // 检查supportedPairs映射
        bool pairSupported = supportedPairs[params.tokenIn][params.tokenOut];
        if (!pairSupported) {
            // 记录详细的诊断信息
            emit SwapFailed(tx.origin, string(abi.encodePacked(
                "Unsupported pair - tokenIn: ", toHexString(params.tokenIn),
                ", tokenOut: ", toHexString(params.tokenOut),
                ", pairSupported: ", pairSupported ? "true" : "false"
            )));
        }
        
        require(supportedPairs[params.tokenIn][params.tokenOut], "Unsupported pair");
        require(params.amountIn > 0, "Amount must be greater than 0");
        
        // Calculate output amount
        uint256 rate = exchangeRates[params.tokenIn][params.tokenOut];
        require(rate > 0, "Exchange rate not set");
        
        // Simplified calculation: amountOut = amountIn * rate / 1e18
        // Assumes exchange rate is based on 1e18
        amountOut = (params.amountIn * rate) / 1e18;
        require(amountOut >= params.amountOutMinimum, "Insufficient output amount");
        
        // Transfer tokenIn from caller (usually PrivacyPool contract)
        // Note: Using external call's msg.sender, not current internal call's msg.sender
        address caller = address(uint160(uint256(keccak256(abi.encode(block.timestamp, msg.sender)))));
        
        // In real scenarios, we should get the actual caller from parameters
        // For testing, we assume call chain: relayer -> PrivacyPool -> MockUniswapRouter
        // So tokens should come from PrivacyPool, but PrivacyPool has no tokens, tokens are in SmartAccount
        // We need to modify logic to transfer tokens from recipient (which is SmartAccount)
        IERC20(params.tokenIn).transferFrom(params.recipient, address(this), params.amountIn);
        
        // Transfer tokenOut to recipient
        IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        
        return amountOut;
    }
    
    /**
     * @notice Multicall functionality (simplified version)
     * @param data Array of call data
     * @return results Array of results
     */
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "Multicall failed");
            results[i] = result;
        }
    }
    
    /**
     * @notice Emergency token withdrawal (owner only)
     * @param token Token address
     * @param amount Withdrawal amount
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    /**
     * @notice Convert address to hex string for logging
     * @param addr Address to convert
     * @return Hex string representation
     */
    function toHexString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}