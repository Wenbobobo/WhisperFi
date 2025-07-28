// test/integration/trade.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "../environment";
// @ts-ignore
import { buildPoseidon } from "circomlibjs";
import path from "path";

// 导入 Relayer 组件（Node.js 模块）
const dbModule = require("../../relayer/database");
const IntentProcessor = require("../../relayer/processor");

/**
 * @notice Relayer 核心处理器集成测试
 * @dev 这是一个原子化的集成测试，独立于 Express API 服务器
 * 直接在代码层面测试核心的 processor 模块，验证其核心业务逻辑的正确性
 */
describe("Relayer Trade Processing Integration", function () {
  let env: TestEnvironment;
  let poseidon: any;
  let processor: any;
  let smartAccountAddress: string;

  // 测试用的基础数据
  const WETH_AMOUNT = ethers.parseEther("1.0"); // 1 WETH
  const EXPECTED_USDC_MIN = ethers.parseUnits("1000", 6); // 最少期望 1000 USDC
  
  // 每个测试使用唯一的 secret 来避免 nullifier 冲突
  let currentTestSecret: string;

  before(async function () {
    // 初始化 Poseidon（用于 ZK 证明相关计算）
    poseidon = await buildPoseidon();
    
    // 初始化测试数据库
    await dbModule.setupDatabase();
    console.log("✅ 测试数据库已初始化");
  });

  beforeEach(async function () {
    // 为每个测试生成唯一的 secret，避免 nullifier 冲突
    currentTestSecret = `test-secret-${Date.now()}-${Math.random().toString(36)}`;
    
    // 清理数据库中的旧数据
    await dbModule.clearAllIntents();
    
    // 使用标准的 fixture 模式获取干净的测试环境
    env = await loadFixture(deployTestEnvironment);
    const { factory, user, owner, weth, usdc, mockUniswapRouter } = env;

    // 为每个测试创建新的智能账户
    const userAddress = await user.getAddress();
    await factory.createAccount(userAddress, 0);
    smartAccountAddress = await factory.getAccountAddress(userAddress, 0);

    // 为智能账户发送一些 ETH 用于 gas
    await owner.sendTransaction({
      to: smartAccountAddress,
      value: ethers.parseEther("2"),
    });

    // 为智能账户发送 WETH 作为交易输入资金
    await weth.mint(smartAccountAddress, WETH_AMOUNT);

    // 创建一个固定的 relayer 钱包并为其提供 ETH
    const relayerPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Hardhat账户#2
    const relayerWallet = new ethers.Wallet(relayerPrivateKey, ethers.provider);
    
    // 为 relayer 钱包发送 ETH 作为 gas 费用
    await env.owner.sendTransaction({
      to: relayerWallet.address,
      value: ethers.parseEther("10"), // 发送 10 ETH
    });
    
    // 初始化处理器（直接实例化，不启动 Express 服务）
    processor = new IntentProcessor(
      env.privacyPool,
      ethers.provider,
      {
        chainId: 31337, // 本地测试网
        flashbotsKey: relayerPrivateKey, // 使用有余额的测试账户
      }
    );

    // 为测试环境配置代币地址
    processor.uniswapEncoder.addCustomToken(
      "WETH",
      await env.weth.getAddress(),
      18,
      "Wrapped Ethereum"
    );
    processor.uniswapEncoder.addCustomToken(
      "USDC",
      await env.usdc.getAddress(),
      6,
      "USD Coin"
    );

    // 配置 MockUniswapRouter
    const mockRouterAddress = await mockUniswapRouter.getAddress();
    
    // 覆盖 processor 中的 Uniswap Router 地址
    processor.uniswapEncoder.SWAP_ROUTER_ADDRESS = mockRouterAddress;
    
    // 为 MockUniswapRouter 提供 USDC 资金，使其能够执行 swap
    const usdcForRouter = ethers.parseUnits("100000", 6); // 100,000 USDC
    await usdc.mint(mockRouterAddress, usdcForRouter);
    
    // 设置 WETH -> USDC 的固定汇率 (1 WETH = 2000 USDC)
    const exchangeRate = ethers.parseUnits("2000", 6); // 2000 USDC per WETH
    await mockUniswapRouter.setExchangeRate(
      await weth.getAddress(),
      await usdc.getAddress(),
      exchangeRate
    );

    // 关键：为 Smart Account 的 WETH 代币授权给 MockUniswapRouter
    // 这样 MockUniswapRouter 才能执行 transferFrom
    const maxUint256 = ethers.MaxUint256;
    const smartAccountWethContract = weth.connect(await ethers.getImpersonatedSigner(smartAccountAddress));
    await smartAccountWethContract.approve(mockRouterAddress, maxUint256);

    console.log(`🔧 测试环境准备完成，智能账户: ${smartAccountAddress}`);
    console.log(`📊 MockUniswapRouter 配置完成，地址: ${mockRouterAddress}`);
    console.log(`✅ Smart Account 已授权 WETH 给 MockUniswapRouter`);
  });

  /**
   * @notice 核心测试场景：处理有效的交易意图
   * @dev 这个测试覆盖了完整的 Relayer 处理流程：
   * 1. 准备阶段：存款获得 Note，为智能账户发送 WETH
   * 2. 创建有效的交易意图数据并插入数据库
   * 3. 直接调用 processor.processPendingIntents()
   * 4. 验证数据库状态变化（pending -> confirmed）
   * 5. 验证链上状态变化（nullifier、commitment、代币余额）
   */
  describe("Core Trade Processing", function () {
    it("should process a valid trade intent", async function () {
      this.timeout(60000); // 设置较长的超时时间，因为涉及 ZK 证明生成

      // === 准备阶段 (Arrange) ===
      console.log("📋 开始准备阶段...");

      // 1. 为测试用户在 PrivacyPool 中进行存款，获得一个有效的 Note
      const { commitment, nullifier } = await preparePrivacyPoolDeposit();

      // 2. 验证智能账户的 WETH 余额
      const initialWethBalance = await env.weth.balanceOf(smartAccountAddress);
      const initialUsdcBalance = await env.usdc.balanceOf(smartAccountAddress);
      
      expect(initialWethBalance).to.equal(WETH_AMOUNT, "智能账户应该有 1 WETH");
      expect(initialUsdcBalance).to.equal(0, "智能账户初始 USDC 余额应为 0");

      // 3. 创建有效的交易意图数据
      const tradeIntent = await createValidTradeIntent(commitment, nullifier);

      // 4. 将交易意图插入数据库
      const intentId = dbModule.generateIntentId();
      await dbModule.createIntent(intentId, JSON.stringify(tradeIntent));
      
      console.log(`✅ 交易意图已插入数据库，ID: ${intentId}`);

      // === 执行阶段 (Act) ===
      console.log("🚀 开始执行阶段...");

      // 设置事件监听器来跟踪 MockUniswapRouter 的调用
      const mockRouter = env.mockUniswapRouter;
      const swapCalledEvents: any[] = [];
      const swapFailedEvents: any[] = [];
      
      // 监听 SwapCalled 事件
      const swapCalledFilter = mockRouter.filters.SwapCalled();
      mockRouter.on(swapCalledFilter, (caller, tokenIn, tokenOut, amountIn, amountOut) => {
        console.log(`🎉 SwapCalled 事件: caller=${caller}, tokenIn=${tokenIn}, tokenOut=${tokenOut}, amountIn=${amountIn}, amountOut=${amountOut}`);
        swapCalledEvents.push({ caller, tokenIn, tokenOut, amountIn, amountOut });
      });
      
      // 监听 SwapFailed 事件
      const swapFailedFilter = mockRouter.filters.SwapFailed();
      mockRouter.on(swapFailedFilter, (caller, reason) => {
        console.log(`❌ SwapFailed 事件: caller=${caller}, reason=${reason}`);
        swapFailedEvents.push({ caller, reason });
      });

      // 直接调用处理器的核心函数
      const processingResult = await processor.processIntents();

      console.log("📊 处理结果:", processingResult);
      console.log(`📝 SwapCalled 事件数量: ${swapCalledEvents.length}`);
      console.log(`📝 SwapFailed 事件数量: ${swapFailedEvents.length}`);

      // === 断言阶段 (Assert) ===
      console.log("🔍 开始验证阶段...");

      // 1. 数据库状态断言
      await verifyDatabaseState(intentId);

      // 2. 链上状态断言
      await verifyOnChainState(nullifier, commitment);

      console.log("🎉 测试通过！");
    });
  });

  /**
   * @dev 准备 PrivacyPool 存款，返回 commitment 和 nullifier
   */
  async function preparePrivacyPoolDeposit() {
    const { privacyPool, user } = env;
    
    // 使用当前测试的唯一 secret
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(currentTestSecret));
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    
    // 使用与前端相同的逻辑生成 commitment 和 nullifier
    const commitment = generateCommitment(secretHash, depositAmount);
    const nullifier = generateNullifierHash(secretHash);
    
    // 执行存款
    const tx = await privacyPool.connect(user).deposit(commitment, {
      value: depositAmount
    });
    await tx.wait();
    
    console.log(`💰 存款完成，commitment: ${commitment}`);
    
    return { commitment, nullifier };
  }

  /**
   * @dev 创建有效的交易意图数据
   */
  async function createValidTradeIntent(commitment: string, nullifier: string) {
    // 使用与合约一致的逻辑生成 tradeDataHash
    const tradeDataHash = generateTradeDataHash(smartAccountAddress, WETH_AMOUNT);

    // 这里需要模拟 ZK 证明参数
    // 在真实场景中，这些会通过前端的 ZK 电路生成
    return {
      // ZK 证明参数（模拟）
      pA: ["0x1", "0x2"],
      pB: [["0x3", "0x4"], ["0x5", "0x6"]],
      pC: ["0x7", "0x8"],
      proofRoot: await env.privacyPool.merkleRoot(),
      nullifier: nullifier,
      newCommitment: ethers.hexlify(ethers.randomBytes(32)), // 新的找零 commitment
      tradeDataHash: tradeDataHash,
      
      // 交易意图
      tradeIntent: {
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: WETH_AMOUNT.toString(),
        slippage: "0.5"
      },
      recipient: smartAccountAddress,
      executor: smartAccountAddress
    };
  }

  /**
   * @dev 验证数据库状态
   */
  async function verifyDatabaseState(intentId: string) {
    const intent = await dbModule.getIntentById(intentId);
    
    expect(intent).to.not.be.null;
    expect(intent.status).to.equal("confirmed", 
      "意图状态应该从 pending 变为 confirmed");
    
    console.log("✅ 数据库状态验证通过");
  }

  /**
   * @dev 验证链上状态
   */
  async function verifyOnChainState(nullifier: string, oldCommitment: string) {
    const { privacyPool, weth, usdc, mockUniswapRouter } = env;
    
    // 验证 nullifier 已被使用
    const isNullifierUsed = await privacyPool.nullifiers(nullifier);
    expect(isNullifierUsed).to.be.true;
    
    // 详细的余额调试信息
    const finalWethBalance = await weth.balanceOf(smartAccountAddress);
    const finalUsdcBalance = await usdc.balanceOf(smartAccountAddress);
    const mockRouterWethBalance = await weth.balanceOf(await mockUniswapRouter.getAddress());
    const mockRouterUsdcBalance = await usdc.balanceOf(await mockUniswapRouter.getAddress());
    
    console.log(`📊 余额调试信息:`);
    console.log(`   Smart Account WETH: ${ethers.formatEther(finalWethBalance)} (初始: ${ethers.formatEther(WETH_AMOUNT)})`);
    console.log(`   Smart Account USDC: ${ethers.formatUnits(finalUsdcBalance, 6)} (初始: 0)`);
    console.log(`   MockRouter WETH: ${ethers.formatEther(mockRouterWethBalance)}`);
    console.log(`   MockRouter USDC: ${ethers.formatUnits(mockRouterUsdcBalance, 6)}`);
    
    // 验证代币余额变化
    expect(finalWethBalance).to.be.lessThan(WETH_AMOUNT,
      "智能账户的 WETH 余额应该减少");
    expect(finalUsdcBalance).to.be.greaterThan(0,
      "智能账户应该收到 USDC");
    
    console.log(`✅ 链上状态验证通过 - WETH: ${ethers.formatEther(finalWethBalance)}, USDC: ${ethers.formatUnits(finalUsdcBalance, 6)}`);
  }

  // 辅助函数：生成 commitment（与前端逻辑保持一致）
  function generateCommitment(secret: string, amount: bigint): string {
    const secretBigInt = BigInt(secret);
    const hash = poseidon([secretBigInt, amount]);
    return '0x' + poseidon.F.toObject(hash).toString(16).padStart(64, '0');
  }

  // 辅助函数：生成 nullifier hash（与前端逻辑保持一致）
  function generateNullifierHash(secret: string): string {
    const secretBigInt = BigInt(secret);
    const hash = poseidon([secretBigInt]);
    return '0x' + poseidon.F.toObject(hash).toString(16).padStart(64, '0');
  }

  // 辅助函数：生成 trade data hash（与合约逻辑保持一致）
  function generateTradeDataHash(recipient: string, amount: bigint): string {
    // 1. 精确模拟 Solidity 的 abi.encodePacked
    const packedData = ethers.solidityPacked(
      ['address', 'uint256'],
      [recipient, amount]
    );

    // 2. 对打包后的 bytes 进行 Poseidon 哈希
    // 注意：Poseidon 哈希通常处理数字（BigInt），所以我们需要将 bytes 转换为一个 BigInt
    const packedDataBigInt = BigInt(packedData);
    const hash = poseidon([packedDataBigInt]);
    
    return '0x' + poseidon.F.toObject(hash).toString(16).padStart(64, '0');
  }
});