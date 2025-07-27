const { ethers } = require("ethers");
const { 
    getPendingIntents, 
    updateIntentWithTxHash, 
    updateIntentStatus,
    incrementRetryCount 
} = require('./database');
const { UniswapEncoder } = require('./uniswap');
const { createFlashbotsProvider } = require('./flashbots');

// 重试配置
const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY: 1000, // 1秒
    MAX_DELAY: 30000  // 30秒
};

/**
 * 增强的意图处理器类
 * 支持交易编码和 Flashbots 集成
 */
class IntentProcessor {
    constructor(privacyPool, provider, options = {}) {
        this.privacyPool = privacyPool;
        this.provider = provider;
        this.isProcessing = false;
        this.processingInterval = null;
        
        // 创建 Flashbots 认证签名器
        this.flashbotsSigner = this.createFlashbotsSigner(options.flashbotsKey);
        
        // 初始化 Uniswap 编码器
        this.uniswapEncoder = new UniswapEncoder(provider, options.chainId || 1);
        
        // 初始化 Flashbots 提供商
        this.flashbotsProvider = createFlashbotsProvider(
            provider, 
            this.flashbotsSigner,
            options.flashbots || {}
        );
        
        console.log('🔧 增强版意图处理器已初始化');
        console.log('  - Uniswap 编码器:', this.uniswapEncoder.getSupportedTokens());
        console.log('  - Flashbots 状态:', this.flashbotsProvider.getStatus());
    }

    /**
     * 创建 Flashbots 认证签名器
     * @param {string} privateKey - 私钥（可选）
     * @returns {ethers.Wallet} 签名器
     */
    createFlashbotsSigner(privateKey) {
        if (privateKey) {
            return new ethers.Wallet(privateKey, this.provider);
        }
        
        // 如果没有提供私钥，生成一个临时的
        const randomWallet = ethers.Wallet.createRandom();
        console.log('⚠️  使用临时 Flashbots 签名器:', randomWallet.address);
        return randomWallet.connect(this.provider);
    }

    /**
     * 启动自动处理器
     * @param {number} intervalMs - 处理间隔（毫秒）
     */
    start(intervalMs = 30000) {
        if (this.processingInterval) {
            console.log('⚠️  处理器已在运行中');
            return;
        }

        console.log(`🚀 启动增强版意图处理器，处理间隔: ${intervalMs/1000}秒`);
        
        // 立即执行一次
        this.processIntents();
        
        // 设置定时处理
        this.processingInterval = setInterval(() => {
            this.processIntents();
        }, intervalMs);
    }

    /**
     * 停止自动处理器
     */
    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('⏹️  意图处理器已停止');
        }
    }

    /**
     * 处理所有待处理的意图
     * @returns {Promise<Object>} 处理结果统计
     */
    async processIntents() {
        if (this.isProcessing) {
            console.log('⏳ 处理器正在运行中，跳过本次执行');
            return { status: 'skipped', reason: 'already_processing' };
        }

        this.isProcessing = true;
        let stats = {
            total: 0,
            success: 0,
            failed: 0,
            retried: 0,
            skipped: 0
        };

        try {
            const pendingIntents = await getPendingIntents();
            stats.total = pendingIntents.length;

            if (pendingIntents.length === 0) {
                console.log('📭 没有待处理的意图');
                return { status: 'completed', stats };
            }

            console.log(`📋 发现 ${pendingIntents.length} 个待处理意图，开始处理...`);

            // 逐个处理意图
            for (const intent of pendingIntents) {
                try {
                    const result = await this.processSingleIntent(intent);
                    if (result.success) {
                        stats.success++;
                    } else if (result.retried) {
                        stats.retried++;
                    } else if (result.failed) {
                        stats.failed++;
                    } else {
                        stats.skipped++;
                    }
                } catch (error) {
                    console.error(`❌ 处理意图失败 (ID: ${intent.id}):`, error);
                    stats.failed++;
                }
            }

            console.log(`✅ 处理完成: 成功 ${stats.success}, 失败 ${stats.failed}, 重试 ${stats.retried}, 跳过 ${stats.skipped}`);
            return { status: 'completed', stats };

        } catch (error) {
            console.error('❌ 批量处理意图时出错:', error);
            return { status: 'error', error: error.message, stats };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 处理单个意图
     * @param {Object} intent - 意图对象
     * @returns {Promise<Object>} 处理结果
     */
    async processSingleIntent(intent) {
        const { id, intent_data, retry_count } = intent;
        
        console.log(`🔄 开始处理意图: ${id} (重试次数: ${retry_count})`);

        // 检查重试次数是否超限
        if (retry_count >= RETRY_CONFIG.MAX_RETRIES) {
            console.log(`❌ 意图 ${id} 超过最大重试次数，标记为失败`);
            await updateIntentStatus(id, 'failed');
            return { failed: true, reason: 'max_retries_exceeded' };
        }

        try {
            // 解析意图数据，决定处理方式
            const processedResult = await this.processIntentData(intent_data);
            
            if (processedResult.success) {
                // 更新状态为已提交并记录交易哈希
                await updateIntentWithTxHash(id, 'submitted', processedResult.txHash);
                console.log(`✅ 意图 ${id} 交易已提交: ${processedResult.txHash}`);
                
                // 监听交易确认
                this.monitorTransaction(id, processedResult.txHash);
                
                return { success: true, txHash: processedResult.txHash };
            } else {
                // 处理失败，增加重试次数
                await incrementRetryCount(id);
                console.log(`⚠️  意图 ${id} 执行失败，将重试: ${processedResult.error}`);
                
                return { retried: true, error: processedResult.error };
            }

        } catch (error) {
            // 增加重试次数
            await incrementRetryCount(id);
            console.error(`❌ 意图 ${id} 处理异常:`, error);
            
            return { retried: true, error: error.message };
        }
    }

    /**
     * 处理意图数据，支持多种类型的意图
     * @param {Object} intentData - 意图数据
     * @returns {Promise<Object>} 处理结果
     */
    async processIntentData(intentData) {
        // 检查意图类型
        if (this.isTradeIntent(intentData)) {
            // 处理交易意图（需要编码）
            return await this.processTradeIntent(intentData);
        } else if (this.isEncodedIntent(intentData)) {
            // 处理已编码的意图（直接执行）
            return await this.processEncodedIntent(intentData);
        } else {
            throw new Error('未知的意图类型');
        }
    }

    /**
     * 判断是否为交易意图
     * @param {Object} intentData - 意图数据
     * @returns {boolean} 是否为交易意图
     */
    isTradeIntent(intentData) {
        return intentData.tradeIntent && 
               intentData.tradeIntent.tokenIn && 
               intentData.tradeIntent.tokenOut;
    }

    /**
     * 判断是否为已编码的意图
     * @param {Object} intentData - 意图数据
     * @returns {boolean} 是否为已编码意图
     */
    isEncodedIntent(intentData) {
        return intentData.pA && 
               intentData.pB && 
               intentData.pC && 
               intentData.target;
    }

    /**
     * 处理交易意图（需要先编码）
     * @param {Object} intentData - 意图数据
     * @returns {Promise<Object>} 处理结果
     */
    async processTradeIntent(intentData) {
        try {
            console.log('🎯 处理交易意图:', intentData.tradeIntent);
            
            // 1. 准备完整的交易数据（包含 recipient）
            const completeTradeData = {
                ...intentData.tradeIntent,
                recipient: intentData.recipient || this.privacyPool.target
            };
            
            console.log('📋 完整的交易数据:', completeTradeData);
            
            // 2. 验证交易意图
            this.uniswapEncoder.validateTradeIntent(completeTradeData);
            
            // 3. 编码 Uniswap 交易
            const encodedTrade = await this.uniswapEncoder.encodeTrade(completeTradeData);
            
            console.log('📦 Uniswap 交易编码完成:', {
                target: encodedTrade.target,
                expectedOutput: encodedTrade.expectedOutput,
                route: encodedTrade.route
            });
            
            // 3. 构建完整的 PrivacyPool 交易数据
            const fullIntentData = {
                ...intentData,
                target: encodedTrade.target,
                callData: encodedTrade.calldata,
                value: encodedTrade.value || "0",
                // 保留原有的 ZK 证明数据
                pA: intentData.pA,
                pB: intentData.pB,
                pC: intentData.pC,
                proofRoot: intentData.proofRoot,
                nullifier: intentData.nullifier,
                newCommitment: intentData.newCommitment,
                tradeDataHash: intentData.tradeDataHash
            };
            
            // 4. 执行编码后的交易
            return await this.executeTransactionWithFlashbots(fullIntentData);
            
        } catch (error) {
            console.error('❌ 交易意图处理失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 处理已编码的意图
     * @param {Object} intentData - 意图数据
     * @returns {Promise<Object>} 处理结果
     */
    async processEncodedIntent(intentData) {
        console.log('⚡ 处理已编码意图');
        return await this.executeTransactionWithFlashbots(intentData);
    }

    /**
     * 使用 Flashbots 执行交易
     * @param {Object} intentData - 意图数据
     * @returns {Promise<Object>} 执行结果
     */
    async executeTransactionWithFlashbots(intentData) {
        try {
            const { pA, pB, pC, proofRoot, nullifier, newCommitment, tradeDataHash, executor, target, callData } = intentData;

            // 验证必要字段
            if (!pA || !pB || !pC || !proofRoot || !nullifier || !newCommitment || !tradeDataHash || !target) {
                return { success: false, error: '缺少必要的交易参数' };
            }

            // 1. 构建 PrivacyPool 交易
            const privacyPoolTx = {
                to: this.privacyPool.target,
                data: this.privacyPool.interface.encodeFunctionData('trade', [
                    pA,
                    pB,
                    pC,
                    proofRoot,
                    nullifier,
                    newCommitment,
                    tradeDataHash,
                    executor || this.flashbotsSigner.address,
                    target,
                    callData || "0x"
                ]),
                value: intentData.value || "0",
                gasLimit: ethers.parseUnits("500000", "wei"), // 设置较高的 gas limit
            };

            console.log('📡 准备通过 Flashbots 发送交易');

            // 2. 获取目标区块号
            const targetBlockNumber = await this.flashbotsProvider.getTargetBlockNumber(1);
            
            // 3. 发送 Bundle
            const result = await this.flashbotsProvider.sendBundle([privacyPoolTx], targetBlockNumber);
            
            if (result.success) {
                console.log(`🎉 Flashbots Bundle 发送成功: ${result.bundleHash || result.txHash}`);
                return { 
                    success: true, 
                    txHash: result.txHash || result.bundleHash,
                    method: result.method
                };
            } else {
                return { success: false, error: 'Bundle 发送失败' };
            }

        } catch (error) {
            console.error('❌ Flashbots 交易执行失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 监听交易状态
     * @param {string} intentId - 意图ID
     * @param {string} txHash - 交易哈希
     */
    async monitorTransaction(intentId, txHash) {
        try {
            console.log(`👀 开始监听交易: ${txHash}`);
            
            // 等待交易确认
            const receipt = await this.provider.waitForTransaction(txHash);
            
            if (receipt && receipt.status === 1) {
                // 交易成功确认
                await updateIntentStatus(intentId, 'confirmed');
                console.log(`🎉 意图 ${intentId} 交易确认成功`);
            } else {
                // 交易失败
                await updateIntentStatus(intentId, 'failed');
                console.log(`💥 意图 ${intentId} 交易确认失败`);
            }
            
        } catch (error) {
            console.error(`❌ 监听交易失败 (意图: ${intentId}, 交易: ${txHash}):`, error);
            // 监听失败，但不改变状态，保持 'submitted' 状态
        }
    }

    /**
     * 获取交易报价（用于前端展示）
     * @param {Object} tradeIntent - 交易意图
     * @returns {Promise<Object>} 报价信息
     */
    async getTradeQuote(tradeIntent) {
        try {
            console.log('💰 获取交易报价:', tradeIntent);
            
            this.uniswapEncoder.validateTradeIntent(tradeIntent, false);
            const quote = await this.uniswapEncoder.getQuote(
                tradeIntent.tokenIn,
                tradeIntent.tokenOut,
                tradeIntent.amountIn
            );
            
            return {
                success: true,
                quote: quote
            };
            
        } catch (error) {
            console.error('❌ 获取报价失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取处理器状态
     * @returns {Object} 处理器状态信息
     */
    getStatus() {
        return {
            isRunning: !!this.processingInterval,
            isProcessing: this.isProcessing,
            config: RETRY_CONFIG,
            uniswap: {
                supportedTokens: this.uniswapEncoder.getSupportedTokens()
            },
            flashbots: this.flashbotsProvider.getStatus()
        };
    }

    /**
     * 更新 Flashbots 配置
     * @param {Object} newOptions - 新的配置选项
     */
    updateFlashbotsConfig(newOptions) {
        this.flashbotsProvider.updateOptions(newOptions);
        console.log('⚙️  Flashbots 配置已更新');
    }
}

module.exports = IntentProcessor;