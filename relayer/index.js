require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require("express");
const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');
const { 
    setupDatabase, 
    createIntent, 
    getIntentById, 
    updateIntentStatus, 
    generateIntentId 
} = require('./database');
const IntentProcessor = require('./processor');

const app = express();
const port = 3000;

// --- Ethers Setup ---

// 1. Connect to the local Hardhat network
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

// 2. Load the contract ABI
const abiPath = path.join(__dirname, '../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json');
const contractArtifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
const privacyPoolAbi = contractArtifact.abi;

// 3. Get the contract address (replace with your actual deployed address)
// You can get this address after running `npx hardhat run scripts/deploy.js --network localhost`
const privacyPoolAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

// 4. Create a contract instance
// We need a signer to send transactions, for now we'll get the first Hardhat account
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider); // Make sure to set a PRIVATE_KEY env variable
const privacyPool = new ethers.Contract(privacyPoolAddress, privacyPoolAbi, signer);

console.log(`Connected to PrivacyPool at address: ${privacyPoolAddress}`);

// 创建增强版意图处理器实例
const intentProcessor = new IntentProcessor(privacyPool, provider, {
    chainId: 1, // 主网链ID，测试时可调整
    flashbotsKey: process.env.FLASHBOTS_PRIVATE_KEY, // 可选的 Flashbots 私钥
    flashbots: {
        enabled: process.env.FLASHBOTS_ENABLED !== 'false', // 默认启用
        simulationMode: process.env.NODE_ENV === 'development', // 开发环境使用模拟模式
        fallbackToRegular: true // 允许降级到常规交易
    }
});

// --- Express Server ---

app.use(express.json());

// 新的意图提交端点
app.post("/intent/trade", async (req, res) => {
  const { pA, pB, pC, proofRoot, nullifier, newCommitment, tradeDataHash, executor, target, callData } = req.body;

  console.log("收到交易意图请求:", req.body);

  try {
    // 基础输入验证
    if (!pA || !pB || !pC || !proofRoot || !nullifier || !newCommitment || !tradeDataHash || !executor || !target) {
      return res.status(400).json({ error: "缺少交易必需字段" });
    }

    // 生成唯一的意图 ID
    const intentId = generateIntentId();
    
    // 将交易意图存储到数据库
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
      callData: callData || "0x"
    });

    console.log(`✅ 交易意图已创建，ID: ${intentId}`);
    
    // 返回意图 ID 和状态
    res.json({ 
      status: "pending", 
      intentId: intentId,
      message: "交易意图已接收并正在处理中"
    });

  } catch (error) {
    console.error("创建交易意图时出错:", error);
    res.status(500).json({ error: "创建交易意图失败", details: error.message });
  }
});

// 保留原有的直接交易端点（用于向后兼容）
app.post("/relay/trade", async (req, res) => {
  const { pA, pB, pC, proofRoot, nullifier, newCommitment, tradeDataHash, executor, target, callData } = req.body;

  console.log("收到直接交易请求:", req.body);

  try {
    // 基础输入验证
    if (!pA || !pB || !pC || !proofRoot || !nullifier || !newCommitment || !tradeDataHash || !executor || !target) {
      return res.status(400).json({ error: "缺少交易必需字段" });
    }

    // 直接与 PrivacyPool 合约交互 - 使用 withdraw 函数而不是 trade
    const tx = await privacyPool.withdraw(
      pA,
      pB,
      pC,
      proofRoot,
      nullifier,
      executor, // _recipient
      "0", // _fee (设为0，表示没有手续费)
      signer.address // _relayer
    );

    console.log(`交易已发送: ${tx.hash}`);
    await tx.wait();
    console.log(`交易已确认: ${tx.hash}`);

    res.json({ status: "success", txHash: tx.hash });

  } catch (error) {
    console.error("直接交易执行出错:", error);
    res.status(500).json({ error: "交易执行失败", details: error.message });
  }
});

// 新的交易意图端点（支持 Uniswap 交易）
app.post("/intent/trade-swap", async (req, res) => {
  const {
    pA, pB, pC, proofRoot, nullifier, newCommitment, tradeDataHash,
    tradeIntent, recipient
  } = req.body;

  console.log("收到 Uniswap 交易意图请求:", { tradeIntent, recipient });

  try {
    // 验证必要的 ZK 证明字段
    if (!pA || !pB || !pC || !proofRoot || !nullifier || !newCommitment || !tradeDataHash) {
      return res.status(400).json({ error: "缺少 ZK 证明字段" });
    }

    // 验证交易意图字段
    if (!tradeIntent || !tradeIntent.tokenIn || !tradeIntent.tokenOut || !tradeIntent.amountIn) {
      return res.status(400).json({ error: "缺少交易意图字段" });
    }

    // 生成唯一的意图 ID
    const intentId = generateIntentId();
    
    // 将交易意图存储到数据库
    await createIntent(intentId, {
      // ZK 证明数据
      pA, pB, pC, proofRoot, nullifier, newCommitment, tradeDataHash,
      // 交易意图数据
      tradeIntent: tradeIntent,
      recipient: recipient || privacyPoolAddress,
      // 标记为交易意图类型
      intentType: 'trade-swap'
    });

    console.log(`✅ Uniswap 交易意图已创建，ID: ${intentId}`);
    
    res.json({
      status: "pending",
      intentId: intentId,
      message: "Uniswap 交易意图已接收并正在处理中"
    });

  } catch (error) {
    console.error("创建 Uniswap 交易意图时出错:", error);
    res.status(500).json({ error: "创建交易意图失败", details: error.message });
  }
});

// 获取交易报价端点
app.post("/trade/quote", async (req, res) => {
  const { tokenIn, tokenOut, amountIn } = req.body;

  console.log("收到交易报价请求:", { tokenIn, tokenOut, amountIn });

  try {
    if (!tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({ error: "缺少报价请求字段" });
    }

    const quoteResult = await intentProcessor.getTradeQuote({
      tokenIn, tokenOut, amountIn
    });

    if (quoteResult.success) {
      res.json({
        success: true,
        quote: quoteResult.quote,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: "获取报价失败",
        details: quoteResult.error
      });
    }

  } catch (error) {
    console.error("获取交易报价时出错:", error);
    res.status(500).json({ error: "获取报价失败", details: error.message });
  }
});

// 意图状态查询端点
app.get("/intent/status/:intentId", async (req, res) => {
  const { intentId } = req.params;
  
  console.log(`查询意图状态，ID: ${intentId}`);

  try {
    // 从数据库查询意图记录
    const intent = await getIntentById(intentId);
    
    if (!intent) {
      return res.status(404).json({ 
        error: "未找到对应的交易意图",
        intentId: intentId 
      });
    }

    // 返回完整的意图状态信息
    res.json({
      intentId: intent.id,
      status: intent.status,
      tx_hash: intent.tx_hash,
      retry_count: intent.retry_count,
      created_at: intent.created_at,
      updated_at: intent.updated_at,
      intent_data: intent.intent_data
    });

  } catch (error) {
    console.error(`查询意图状态出错 (ID: ${intentId}):`, error);
    res.status(500).json({ 
      error: "查询意图状态失败", 
      details: error.message 
    });
  }
});

// 手动触发意图处理端点
app.post("/intent/process", async (req, res) => {
  console.log('🔧 收到手动处理意图请求');

  try {
    const result = await intentProcessor.processIntents();
    res.json({
      message: "意图处理完成",
      result: result
    });
  } catch (error) {
    console.error('❌ 手动处理意图失败:', error);
    res.status(500).json({
      error: "手动处理意图失败",
      details: error.message
    });
  }
});

// 处理器状态查询端点
app.get("/processor/status", (req, res) => {
  const status = intentProcessor.getStatus();
  res.json({
    processor_status: status,
    timestamp: new Date().toISOString()
  });
});

// 启动/停止处理器的管理端点
app.post("/processor/start", (req, res) => {
  const { interval } = req.body; // 可选的处理间隔
  try {
    intentProcessor.start(interval);
    res.json({
      message: "意图处理器已启动",
      interval: interval || 30000
    });
  } catch (error) {
    console.error('❌ 启动处理器失败:', error);
    res.status(500).json({
      error: "启动处理器失败",
      details: error.message
    });
  }
});

app.post("/processor/stop", (req, res) => {
  try {
    intentProcessor.stop();
    res.json({
      message: "意图处理器已停止"
    });
  } catch (error) {
    console.error('❌ 停止处理器失败:', error);
    res.status(500).json({
      error: "停止处理器失败",
      details: error.message
    });
  }
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await setupDatabase();
    
    // 启动 Express 服务器
    app.listen(port, () => {
      console.log(`🚀 Relayer 服务已启动，监听端口: http://localhost:${port}`);
      console.log(`📋 可用端点:`);
      console.log(`   POST /intent/trade      - 提交交易意图`);
      console.log(`   GET  /intent/status/:id - 查询意图状态`);
      console.log(`   POST /intent/process    - 手动触发处理`);
      console.log(`   GET  /processor/status  - 查询处理器状态`);
      console.log(`   POST /processor/start   - 启动自动处理器`);
      console.log(`   POST /processor/stop    - 停止自动处理器`);
      console.log(`   POST /relay/trade       - 直接执行交易（向后兼容）`);
      console.log(`   POST /intent/trade-swap - 提交 Uniswap 交易意图`);
      console.log(`   POST /trade/quote       - 获取交易报价`);
      
      // 自动启动处理器（30秒间隔）
      console.log(`🤖 自动启动意图处理器...`);
      intentProcessor.start(30000);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 收到退出信号，正在优雅关闭...');
  intentProcessor.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在优雅关闭...');
  intentProcessor.stop();
  process.exit(0);
});

// 启动服务器
startServer();
