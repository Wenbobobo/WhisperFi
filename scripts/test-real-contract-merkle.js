// scripts/test-real-contract-merkle.js
// 直接与实际部署的合约交互来测试Merkle根问题

const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

// 手动定义合约地址（从contracts.ts文件中获取）
const CONTRACTS = {
  PRIVACY_POOL_ADDRESS: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  PAYMASTER_ADDRESS: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
  SMART_ACCOUNT_FACTORY_ADDRESS: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  EXECUTOR_ADDRESS: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  VERIFIER_ADDRESS: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  ENTRYPOINT_ADDRESS: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  POSEIDON_HASHER_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  POSEIDON_HASHER5_ADDRESS: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
};

async function testRealContractMerkle() {
  console.log("=== 实际合约Merkle根测试 ===");
  
  // 连接到Hardhat网络
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  
  // 获取合约地址
  const privacyPoolAddress = CONTRACTS.PRIVACY_POOL_ADDRESS;
  
  console.log("隐私池合约地址:", privacyPoolAddress);
  
  // 获取存款事件
  try {
    const depositEvents = await provider.getLogs({
      address: privacyPoolAddress,
      topics: [
        ethers.id("Deposit(bytes32,uint32,uint256)")
      ],
      fromBlock: "earliest"
    });
    
    console.log(`找到 ${depositEvents.length} 个存款事件`);
    
    // 解析事件数据
    const commitments = [];
    for (const event of depositEvents) {
      // Deposit事件有3个索引参数：commitment(索引), leafIndex(索引), timestamp(非索引)
      // 所以data中只包含timestamp
      const commitment = event.topics[1]; // 第一个索引参数是commitment
      commitments.push(commitment);
      console.log(`存款commitment: ${commitment}`);
    }
    
    if (commitments.length === 0) {
      console.log("没有找到存款事件，使用测试数据");
      commitments.push(
        "0x1c554a5755338096179ca954068c68504101d565ebc0b9b760742695683c4657",
        "0x2d9a1f8e64b7c2d5f8a93b7e4c6d2f1e8a7b9c6d5e4f3a2b1c0d9e8f7a6b5c4d"
      );
    }
    
    // 获取合约实例
    const privacyPoolABI = [
      "function merkleRoot() view returns (bytes32)",
      "function nextLeafIndex() view returns (uint256)"
    ];
    
    const privacyPool = new ethers.Contract(privacyPoolAddress, privacyPoolABI, provider);
    
    // 获取合约中的Merkle根
    const contractMerkleRoot = await privacyPool.merkleRoot();
    const nextLeafIndex = await privacyPool.nextLeafIndex();
    
    console.log("合约Merkle根:", contractMerkleRoot);
    console.log("合约下一个叶子索引:", nextLeafIndex);
    
    // 使用与前端相同的逻辑构建Merkle树
    const poseidon = await buildPoseidon();
    const TREE_DEPTH = 16; // 与合约一致使用16层
    const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814"; // 与合约一致的零值
    
    // 初始化零值数组（与合约一致）
    const zeros = [];
    let currentZero = ZERO_VALUE;
    for (let i = 0; i < TREE_DEPTH; i++) {
      zeros[i] = currentZero;
      const hash = poseidon([BigInt(currentZero), BigInt(currentZero)]);
      currentZero = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }
    
    console.log("零值计算完成");
    
    // 构建Merkle树（与前端一致）
    let tree = Array.from({ length: TREE_DEPTH + 1 }, () => []);
    
    // 设置叶子节点
    tree[0] = [...commitments];
    
    // 填充到2的幂次
    const maxLeaves = Math.pow(2, TREE_DEPTH);
    while (tree[0].length < maxLeaves) {
      tree[0].push(ZERO_VALUE);
    }
    
    console.log(`叶子节点数量: ${tree[0].length}`);
    
    // 自底向上构建树（与前端一致）
    for (let level = 1; level <= TREE_DEPTH; level++) {
      const currentLevel = tree[level];
      const previousLevel = tree[level - 1];
      
      for (let i = 0; i < previousLevel.length; i += 2) {
        const left = previousLevel[i];
        const right = previousLevel[i + 1] || ZERO_VALUE;
        
        // 使用与合约相同的哈希逻辑
        const hash = poseidon([BigInt(left), BigInt(right)]);
        const hashStr = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
        currentLevel.push(hashStr);
      }
    }
    
    const frontendMerkleRoot = tree[TREE_DEPTH][0];
    console.log("前端计算的Merkle根:", frontendMerkleRoot);
    
    // 比较两个根是否一致
    console.log("\n=== 根一致性检查 ===");
    console.log("合约根 === 前端根:", contractMerkleRoot === frontendMerkleRoot);
    if (contractMerkleRoot !== frontendMerkleRoot) {
      console.log("❌ 发现Merkle根不匹配问题！");
      console.log("合约根:", contractMerkleRoot);
      console.log("前端根:", frontendMerkleRoot);
    } else {
      console.log("✅ Merkle根匹配");
    }
    
    // 验证特定叶子的Merkle证明
    if (commitments.length > 0) {
      const leafIndex = 0; // 验证第一个commitment
      const leaf = commitments[leafIndex];
      
      console.log(`\n验证叶子节点 ${leafIndex}: ${leaf}`);
      
      // 生成Merkle证明（与前端一致）
      const pathElements = [];
      const pathIndices = [];
      let currentIndex = leafIndex;
      
      for (let level = 0; level < TREE_DEPTH; level++) {
        const isLeft = currentIndex % 2 === 0;
        const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
        
        // 获取兄弟节点（或零值）
        const sibling = tree[level][siblingIndex] || ZERO_VALUE;
        pathElements.push(sibling);
        
        // 路径索引：0 = 当前节点是左节点，1 = 当前节点是右节点
        pathIndices.push(isLeft ? 0 : 1);
        
        // 移动到父节点索引
        currentIndex = Math.floor(currentIndex / 2);
      }
      
      console.log("路径元素(前5个):", pathElements.slice(0, 5));
      console.log("路径索引(前5个):", pathIndices.slice(0, 5));
      
      // 验证Merkle证明（与前端一致）
      let currentHash = leaf;
      for (let i = 0; i < pathElements.length; i++) {
        const sibling = pathElements[i];
        const isLeft = pathIndices[i] === 0;
        
        // 与电路相同的逻辑：如果pathIndices[i] = 0，当前是左节点，兄弟是右节点
        const left = isLeft ? currentHash : sibling;
        const right = isLeft ? sibling : currentHash;
        
        const hash = poseidon([BigInt(left), BigInt(right)]);
        currentHash = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
      }
      
      console.log("通过证明计算出的根:", currentHash);
      console.log("与前端计算的根是否匹配:", currentHash === frontendMerkleRoot);
      
      // 模拟电路输入（与前端传递给电路的输入一致）
      const circuitInput = {
        secret: BigInt("123456789"),
        amount: BigInt("100000000000000000"), // 0.1 ETH in wei
        pathElements: pathElements.map(el => BigInt(el)),
        pathIndices: pathIndices,
        merkleRoot: BigInt(frontendMerkleRoot),
        nullifier: BigInt("987654321")
      };
      
      console.log("\n=== 电路输入 ===");
      console.log("Secret:", circuitInput.secret.toString());
      console.log("Amount:", circuitInput.amount.toString());
      console.log("Merkle根:", circuitInput.merkleRoot.toString());
      console.log("Nullifier:", circuitInput.nullifier.toString());
      console.log("路径元素数量:", circuitInput.pathElements.length);
      console.log("路径索引数量:", circuitInput.pathIndices.length);
    }
    
  } catch (error) {
    console.error("测试过程中出错:", error.message);
    console.error("堆栈跟踪:", error.stack);
  }
  
  console.log("\n=== 测试完成 ===");
  console.log("请检查以下可能的问题:");
  console.log("1. 前端获取的存款事件顺序是否与区块链一致");
  console.log("2. 前端构建的Merkle树是否与合约一致");
  console.log("3. 传递给电路的Merkle根是否正确");
}

// 运行测试
testRealContractMerkle().catch(console.error);