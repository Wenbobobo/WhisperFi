// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUniswapRouter
 * @notice 用于测试的简化版 Uniswap 路由器
 * @dev 实现基本的代币交换功能，支持测试环境中的代币交易验证
 */
contract MockUniswapRouter is Ownable {
    
    // 添加事件用于调试
    event SwapCalled(address indexed caller, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event SwapFailed(address indexed caller, string reason);
    
    constructor() Ownable(msg.sender) {
        // 构造函数现在符合新版 OpenZeppelin Ownable 要求
    }
    
    // 简化的交换参数结构
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
    
    // 模拟的汇率映射 (tokenIn => tokenOut => rate)
    // rate 表示 1 tokenIn 可以换取多少 tokenOut (考虑小数位差异)
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    // 支持的代币对
    mapping(address => mapping(address => bool)) public supportedPairs;
    
    /**
     * @notice 设置代币对的汇率
     * @param tokenIn 输入代币地址
     * @param tokenOut 输出代币地址
     * @param rate 汇率 (1 tokenIn = rate * tokenOut)
     */
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external onlyOwner {
        exchangeRates[tokenIn][tokenOut] = rate;
        supportedPairs[tokenIn][tokenOut] = true;
    }
    
    /**
     * @notice 执行精确输入的单笔交换
     * @param params 交换参数
     * @return amountOut 实际输出金额
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
        require(supportedPairs[params.tokenIn][params.tokenOut], "Unsupported pair");
        require(params.amountIn > 0, "Amount must be greater than 0");
        
        // 计算输出金额
        uint256 rate = exchangeRates[params.tokenIn][params.tokenOut];
        require(rate > 0, "Exchange rate not set");
        
        // 简化计算：amountOut = amountIn * rate / 1e18
        // 这里假设汇率以 1e18 为基准
        amountOut = (params.amountIn * rate) / 1e18;
        require(amountOut >= params.amountOutMinimum, "Insufficient output amount");
        
        // 获取真正的调用者（通过 tx.origin 或者通过参数传递）
        address realCaller = tx.origin; // 在测试环境中，这应该是发起交易的账户
        
        // 从真正的调用者转入 tokenIn
        IERC20(params.tokenIn).transferFrom(realCaller, address(this), params.amountIn);
        
        // 向接收者转出 tokenOut
        IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        
        return amountOut;
    }
    
    /**
     * @notice 多调用功能 (简化版本)
     * @param data 调用数据数组
     * @return results 结果数组
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
     * @notice 紧急提取代币（仅限所有者）
     * @param token 代币地址
     * @param amount 提取金额
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}