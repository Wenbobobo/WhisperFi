const { ethers } = require("ethers");
const { getNetworkConfig, getTokenConfig } = require('./config');

/**
 * 环境感知的 Uniswap 交易编码器
 * 使用纯 ethers 实现，避免复杂的 SDK 依赖冲突
 * 专注于核心功能：将交易意图编码为 Uniswap V3 calldata
 * 支持多网络配置，根据 chainId 自动选择合适的代币地址
 */
class UniswapEncoder {
    constructor(provider, chainId = 31337) {
        this.provider = provider;
        this.chainId = chainId;
        
        // 环境感知配置
        try {
            this.networkConfig = getNetworkConfig(chainId);
            this.SWAP_ROUTER_ADDRESS = this.networkConfig.uniswap.routerAddress;
            console.log(`🌐 使用 ${this.networkConfig.name} 网络配置 (Chain ID: ${chainId})`);
        } catch (error) {
            console.warn(`⚠️  网络配置加载失败: ${error.message}`);
            console.warn(`🔄 回退到默认配置`);
            // 回退到安全的默认配置
            this.networkConfig = null;
            this.SWAP_ROUTER_ADDRESS = "0x0000000000000000000000000000000000000000"; // 占位符
        }
        
        // 初始化自定义代币存储
        this.customTokens = {};
        
        // Uniswap V3 SwapRouter02 接口
        this.swapRouterInterface = new ethers.Interface([
            'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
            'function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)',
            'function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)'
        ]);

        console.log('🛠️  环境感知 Uniswap 编码器已初始化');
    }

    /**
     * 编码交易意图为具体的 Uniswap 交易
     * @param {Object} tradeIntent - 交易意图
     * @param {string} tradeIntent.tokenIn - 输入代币符号
     * @param {string} tradeIntent.tokenOut - 输出代币符号
     * @param {string} tradeIntent.amountIn - 输入金额 (字符串形式的 wei)
     * @param {string} tradeIntent.recipient - 接收地址
     * @param {string} tradeIntent.slippage - 滑点容忍度 (如 "0.5" 表示 0.5%)
     * @returns {Promise<Object>} 编码结果
     */
    async encodeTrade(tradeIntent) {
        const { tokenIn, tokenOut, amountIn, recipient, slippage = "0.5" } = tradeIntent;
        
        console.log(`🔄 编码 Uniswap 交易: ${amountIn} ${tokenIn} -> ${tokenOut}`);
        
        try {
            // 1. 验证交易意图
            this.validateTradeIntent(tradeIntent);
            
            // 2. 获取代币信息
            const inputToken = this.getToken(tokenIn);
            const outputToken = this.getToken(tokenOut);
            
            // 3. 构建交易参数
            const params = {
                tokenIn: inputToken.address,
                tokenOut: outputToken.address,
                fee: 3000, // 0.3% 手续费池 (最常用的池子)
                recipient: recipient,
                deadline: Math.floor(Date.now() / 1000) + 1800, // 30分钟后过期
                amountIn: amountIn,
                amountOutMinimum: '0', // 简化版本，实际应该根据滑点计算
                sqrtPriceLimitX96: '0' // 不设置价格限制
            };
            
            // 4. 编码函数调用
            const calldata = this.swapRouterInterface.encodeFunctionData('exactInputSingle', [params]);
            
            // 5. 确定是否需要发送 ETH
            const value = inputToken.symbol === 'WETH' ? amountIn : '0';
            
            console.log(`✅ 交易编码完成，目标合约: ${this.SWAP_ROUTER_ADDRESS}`);
            console.log(`📊 预估 Gas: 200000 (简化估算)`);
            
            return {
                target: this.SWAP_ROUTER_ADDRESS,
                calldata: calldata,
                value: value,
                estimatedGas: '200000', // 简化的固定估算
                expectedOutput: 'unknown', // 简化版本无法精确计算
                route: `${inputToken.symbol} -> ${outputToken.symbol}`,
                impact: 'unknown'
            };
            
        } catch (error) {
            console.error(`❌ 交易编码失败:`, error);
            throw new Error(`交易编码失败: ${error.message}`);
        }
    }

    /**
     * 获取代币信息 - 环境感知版本
     * @param {string} tokenSymbol - 代币符号
     * @returns {Object} 代币信息对象
     */
    getToken(tokenSymbol) {
        try {
            // 优先使用网络特定配置
            if (this.networkConfig) {
                return getTokenConfig(this.chainId, tokenSymbol);
            }
            
            // 回退到本地存储的代币（如果有的话）
            if (this.customTokens && this.customTokens[tokenSymbol.toUpperCase()]) {
                return this.customTokens[tokenSymbol.toUpperCase()];
            }
            
            throw new Error(`代币 ${tokenSymbol} 在网络 ${this.chainId} 上不可用`);
            
        } catch (error) {
            // 提供有用的错误信息
            const supportedTokens = this.networkConfig
                ? Object.keys(this.networkConfig.tokens).join(', ')
                : (this.customTokens ? Object.keys(this.customTokens).join(', ') : '无');
            
            throw new Error(`不支持的代币: ${tokenSymbol}. 当前网络 (${this.chainId}) 支持的代币: ${supportedTokens}`);
        }
    }

    /**
     * 获取交易报价 (简化版本)
     * @param {string} tokenIn - 输入代币符号
     * @param {string} tokenOut - 输出代币符号
     * @param {string} amountIn - 输入金额
     * @returns {Promise<Object>} 报价信息
     */
    async getQuote(tokenIn, tokenOut, amountIn) {
        console.log(`💰 获取交易报价: ${amountIn} ${tokenIn} -> ${tokenOut}`);
        console.log(`⚠️  简化模式：返回模拟报价数据`);
        
        try {
            const inputToken = this.getToken(tokenIn);
            const outputToken = this.getToken(tokenOut);
            
            // 简化版本：返回模拟数据
            // 在实际生产环境中，应该调用 Quoter 合约获取真实报价
            return {
                inputAmount: amountIn,
                outputAmount: 'unknown', // 简化版本无法计算真实输出
                priceImpact: 'unknown',
                route: `${inputToken.symbol} -> ${outputToken.symbol}`,
                gasEstimate: '200000'
            };
            
        } catch (error) {
            console.error(`❌ 获取报价失败:`, error);
            throw error;
        }
    }

    /**
     * 验证交易意图格式
     * @param {Object} tradeIntent - 交易意图对象
     * @param {boolean} requireRecipient - 是否要求 recipient 字段
     * @returns {boolean} 是否有效
     */
    validateTradeIntent(tradeIntent, requireRecipient = true) {
        const { tokenIn, tokenOut, amountIn, recipient } = tradeIntent;
        
        // 检查核心必要字段
        if (!tokenIn || !tokenOut || !amountIn) {
            throw new Error("缺少必要的交易参数: tokenIn, tokenOut, amountIn");
        }
        
        // 检查 recipient（如果需要的话）
        if (requireRecipient && !recipient) {
            throw new Error("缺少必要的交易参数: recipient");
        }
        
        // 验证代币支持
        try {
            this.getToken(tokenIn);
            this.getToken(tokenOut);
        } catch (error) {
            throw new Error(`不支持的代币配对: ${tokenIn}/${tokenOut}`);
        }
        
        // 验证金额格式 (应该是 wei 格式的字符串)
        try {
            const amountBigInt = BigInt(amountIn);
            if (amountBigInt <= 0n) {
                throw new Error(`无效的金额: ${amountIn} (应该是正整数 wei 值)`);
            }
        } catch (error) {
            if (error.message.includes('Cannot convert') || error.message.includes('invalid BigInt')) {
                throw new Error(`无效的金额格式: ${amountIn} (应该是正整数 wei 值)`);
            }
            throw error;
        }
        
        // 验证地址格式（仅在需要 recipient 时）
        if (requireRecipient && !ethers.isAddress(recipient)) {
            throw new Error(`无效的接收地址: ${recipient}`);
        }
        
        // 验证不能是相同代币
        if (tokenIn.toUpperCase() === tokenOut.toUpperCase()) {
            throw new Error(`输入和输出代币不能相同: ${tokenIn}`);
        }
        
        return true;
    }

    /**
     * 获取支持的代币列表 - 环境感知版本
     * @returns {Object} 支持的代币信息
     */
    getSupportedTokens() {
        if (this.networkConfig && this.networkConfig.tokens) {
            return { ...this.networkConfig.tokens };
        }
        
        // 回退到自定义代币
        return { ...this.customTokens };
    }

    /**
     * 添加自定义代币支持 - 环境感知版本
     * @param {string} symbol - 代币符号
     * @param {string} address - 代币合约地址
     * @param {number} decimals - 小数位数
     * @param {string} name - 代币名称
     */
    addCustomToken(symbol, address, decimals, name) {
        if (!ethers.isAddress(address)) {
            throw new Error(`无效的代币地址: ${address}`);
        }
        
        // 确保自定义代币存储已初始化
        if (!this.customTokens) {
            this.customTokens = {};
        }
        
        this.customTokens[symbol.toUpperCase()] = {
            symbol: symbol.toUpperCase(),
            address: address,
            decimals: decimals,
            name: name
        };
        
        console.log(`✅ 已添加自定义代币支持: ${symbol} (${address})`);
    }

    /**
     * 将人类可读的金额转换为 wei
     * @param {string} amount - 人类可读金额 (如 "1.5")
     * @param {string} tokenSymbol - 代币符号
     * @returns {string} wei 格式的金额字符串
     */
    parseAmount(amount, tokenSymbol) {
        const token = this.getToken(tokenSymbol);
        return ethers.parseUnits(amount, token.decimals).toString();
    }

    /**
     * 将 wei 金额转换为人类可读格式
     * @param {string} amountWei - wei 格式的金额
     * @param {string} tokenSymbol - 代币符号
     * @returns {string} 人类可读的金额
     */
    formatAmount(amountWei, tokenSymbol) {
        const token = this.getToken(tokenSymbol);
        return ethers.formatUnits(amountWei, token.decimals);
    }
}

module.exports = { UniswapEncoder };