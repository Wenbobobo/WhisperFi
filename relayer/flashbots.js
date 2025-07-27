const { ethers } = require("ethers");

/**
 * Flashbots 抽象层
 * 提供 MEV 保护的交易发送功能，支持多种实现方式
 */
class FlashbotsProvider {
    constructor(provider, authSigner, options = {}) {
        this.provider = provider;
        this.authSigner = authSigner;
        this.options = {
            // Flashbots Relay URL (默认主网)
            relayUrl: options.relayUrl || 'https://relay.flashbots.net',
            // 是否启用 Flashbots (可用于测试时禁用)
            enabled: options.enabled !== false,
            // 是否使用模拟模式 (在本地测试网络中使用)
            simulationMode: options.simulationMode || false,
            // 最大重试次数
            maxRetries: options.maxRetries || 3,
            ...options
        };
        
        console.log(`🤖 Flashbots Provider 初始化 - 启用状态: ${this.options.enabled}`);
    }

    /**
     * 发送 Bundle 到 Flashbots
     * @param {Array} transactions - 交易数组
     * @param {number} targetBlockNumber - 目标区块号
     * @returns {Promise<Object>} Bundle 提交结果
     */
    async sendBundle(transactions, targetBlockNumber) {
        if (!this.options.enabled) {
            console.log('⚠️  Flashbots 已禁用，使用常规交易发送');
            return await this.sendRegularTransaction(transactions[0]);
        }

        if (this.options.simulationMode) {
            console.log('🎯 模拟模式：直接发送交易');
            return await this.sendRegularTransaction(transactions[0]);
        }

        try {
            console.log(`📦 准备发送 Bundle 到区块 ${targetBlockNumber}`);
            
            // 构建 Bundle
            const bundle = await this.buildBundle(transactions, targetBlockNumber);
            
            // 尝试使用实际的 Flashbots SDK
            if (this.hasFlashbotsSDK()) {
                return await this.sendFlashbotsBundle(bundle, targetBlockNumber);
            } else {
                // 降级到直接 HTTP 调用
                return await this.sendBundleViaHTTP(bundle, targetBlockNumber);
            }
            
        } catch (error) {
            console.error(`❌ Bundle 发送失败:`, error);
            
            // 降级策略：如果 Flashbots 失败，使用常规交易
            if (this.options.fallbackToRegular !== false) {
                console.log('🔄 降级到常规交易发送');
                return await this.sendRegularTransaction(transactions[0]);
            }
            
            throw error;
        }
    }

    /**
     * 构建 Flashbots Bundle
     * @param {Array} transactions - 交易数组  
     * @param {number} targetBlockNumber - 目标区块号
     * @returns {Promise<Object>} Bundle 对象
     */
    async buildBundle(transactions, targetBlockNumber) {
        const bundle = {
            transactions: [],
            blockNumber: targetBlockNumber,
            minTimestamp: 0,
            maxTimestamp: 0
        };

        for (const tx of transactions) {
            // 签名交易
            const signedTx = await this.authSigner.signTransaction(tx);
            bundle.transactions.push(signedTx);
        }

        return bundle;
    }

    /**
     * 检查是否有 Flashbots SDK 可用
     * @returns {boolean} 是否可用
     */
    hasFlashbotsSDK() {
        try {
            // 尝试动态导入 Flashbots SDK
            require.resolve('@flashbots/ethers-provider-bundle');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 使用 Flashbots SDK 发送 Bundle
     * @param {Object} bundle - Bundle 对象
     * @param {number} targetBlockNumber - 目标区块号
     * @returns {Promise<Object>} 发送结果
     */
    async sendFlashbotsBundle(bundle, targetBlockNumber) {
        try {
            // 动态导入 Flashbots SDK
            const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');
            
            const flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider,
                this.authSigner,
                this.options.relayUrl
            );

            console.log('📡 使用 Flashbots SDK 发送 Bundle');
            
            const bundleSubmission = await flashbotsProvider.sendBundle(
                bundle.transactions,
                targetBlockNumber
            );

            // 等待 Bundle 包含结果
            const result = await bundleSubmission.wait();
            
            if (result === 0) {
                return {
                    success: true,
                    bundleHash: bundleSubmission.bundleHash,
                    blockNumber: targetBlockNumber,
                    method: 'flashbots-sdk'
                };
            } else {
                throw new Error(`Bundle 未被包含，结果码: ${result}`);
            }
            
        } catch (error) {
            console.error('❌ Flashbots SDK 发送失败:', error);
            throw error;
        }
    }

    /**
     * 通过 HTTP 直接调用 Flashbots API
     * @param {Object} bundle - Bundle 对象
     * @param {number} targetBlockNumber - 目标区块号
     * @returns {Promise<Object>} 发送结果
     */
    async sendBundleViaHTTP(bundle, targetBlockNumber) {
        try {
            console.log('🌐 使用 HTTP 方式发送 Bundle');
            
            // 构建请求体
            const requestBody = {
                jsonrpc: "2.0",
                id: 1,
                method: "eth_sendBundle",
                params: [{
                    txs: bundle.transactions,
                    blockNumber: `0x${targetBlockNumber.toString(16)}`,
                    minTimestamp: bundle.minTimestamp,
                    maxTimestamp: bundle.maxTimestamp
                }]
            };

            // 创建签名 (简化版本)
            const message = JSON.stringify(requestBody);
            const signature = await this.authSigner.signMessage(message);

            // 发送 HTTP 请求
            const response = await fetch(this.options.relayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Flashbots-Signature': `${this.authSigner.address}:${signature}`
                },
                body: message
            });

            if (!response.ok) {
                throw new Error(`HTTP 请求失败: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(`Flashbots API 错误: ${result.error.message}`);
            }

            return {
                success: true,
                bundleHash: result.result?.bundleHash || 'unknown',
                blockNumber: targetBlockNumber,
                method: 'flashbots-http'
            };
            
        } catch (error) {
            console.error('❌ HTTP Bundle 发送失败:', error);
            throw error;
        }
    }

    /**
     * 发送常规交易 (降级方案)
     * @param {Object} transaction - 交易对象
     * @returns {Promise<Object>} 交易结果
     */
    async sendRegularTransaction(transaction) {
        try {
            console.log('📤 发送常规交易');
            
            // 估算 Gas
            const gasEstimate = await this.provider.estimateGas(transaction);
            transaction.gasLimit = gasEstimate;

            // 获取 Gas 价格
            const feeData = await this.provider.getFeeData();
            transaction.maxFeePerGas = feeData.maxFeePerGas;
            transaction.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

            // 发送交易
            const tx = await this.authSigner.sendTransaction(transaction);
            
            return {
                success: true,
                txHash: tx.hash,
                method: 'regular',
                transaction: tx
            };
            
        } catch (error) {
            console.error('❌ 常规交易发送失败:', error);
            throw error;
        }
    }

    /**
     * 模拟 Bundle 执行 (用于验证)
     * @param {Array} transactions - 交易数组
     * @param {number} blockNumber - 区块号
     * @returns {Promise<Object>} 模拟结果
     */
    async simulateBundle(transactions, blockNumber) {
        try {
            console.log('🔍 模拟 Bundle 执行');
            
            const results = [];
            
            for (const tx of transactions) {
                try {
                    // 使用 callStatic 模拟执行
                    const result = await this.provider.call(tx, blockNumber);
                    results.push({
                        success: true,
                        result: result
                    });
                } catch (error) {
                    results.push({
                        success: false,
                        error: error.message
                    });
                }
            }
            
            return {
                success: results.every(r => r.success),
                results: results,
                blockNumber: blockNumber
            };
            
        } catch (error) {
            console.error('❌ Bundle 模拟失败:', error);
            throw error;
        }
    }

    /**
     * 获取当前区块号
     * @returns {Promise<number>} 当前区块号
     */
    async getCurrentBlockNumber() {
        return await this.provider.getBlockNumber();
    }

    /**
     * 计算目标区块号 (当前区块 + 偏移)
     * @param {number} offset - 区块偏移量 (默认为 1)
     * @returns {Promise<number>} 目标区块号
     */
    async getTargetBlockNumber(offset = 1) {
        const current = await this.getCurrentBlockNumber();
        return current + offset;
    }

    /**
     * 获取 Provider 状态信息
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            enabled: this.options.enabled,
            simulationMode: this.options.simulationMode,
            relayUrl: this.options.relayUrl,
            hasSDK: this.hasFlashbotsSDK(),
            authSigner: this.authSigner.address
        };
    }

    /**
     * 更新配置选项
     * @param {Object} newOptions - 新的配置选项
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log('⚙️  Flashbots 配置已更新:', newOptions);
    }
}

/**
 * 创建 Flashbots Provider 实例的工厂函数
 * @param {Object} provider - Ethers Provider
 * @param {Object} authSigner - 认证签名器
 * @param {Object} options - 配置选项
 * @returns {FlashbotsProvider} Flashbots Provider 实例
 */
function createFlashbotsProvider(provider, authSigner, options = {}) {
    // 根据网络自动调整配置
    const networkName = provider.network?.name || 'unknown';
    
    if (networkName === 'localhost' || networkName === 'hardhat') {
        // 本地测试网络配置
        options = {
            enabled: false,
            simulationMode: true,
            fallbackToRegular: true,
            ...options
        };
    } else if (networkName === 'goerli' || networkName === 'sepolia') {
        // 测试网络配置
        options = {
            relayUrl: 'https://relay-goerli.flashbots.net',
            ...options
        };
    }
    
    return new FlashbotsProvider(provider, authSigner, options);
}

module.exports = {
    FlashbotsProvider,
    createFlashbotsProvider
};