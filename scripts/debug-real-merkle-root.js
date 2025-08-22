// scripts/debug-real-merkle-root.js
// 调试实际存款事件和Merkle根的脚本

const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

async function debugRealMerkleRoot() {
  console.log("=== 实际Merkle根调试 ===");
  
  // 连接到Hardhat网络
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  
  // 获取合约地址（需要根据实际情况调整）
  const privacyPoolAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // 示例地址
  
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
      // 解析事件参数
      const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
        ["bytes32", "uint32", "uint256"],
        event.data
      );
      
      const commitment = decodedData[0];
      commitments.push(commitment);
      console.log(`存款commitment: ${commitment}`);
    }
    
    if (commitments.length === 0) {
      console.log("没有找到存款事件，使用测试数据");
      commitments.push(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "0x2345678901234567890123456789012345678901234567890123456789012345"
      );
    }
    
    // 使用与前端相同的逻辑构建Merkle树
    const poseidon = await buildPoseidon();
    const TREE_DEPTH = 20;
    const ZERO_VALUE = "0";
    
    // 初始化零值数组
    const zeros = [];
    let currentZero = ZERO_VALUE;
    for (let i = 0; i < TREE_DEPTH; i++) {
      zeros[i] = currentZero;
      const hash = poseidon([BigInt(currentZero), BigInt(currentZero)]);
      currentZero = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }
    
    console.log("零值计算完成");
    
    // 构建Merkle树
    let tree = Array.from({ length: TREE_DEPTH + 1 }, () => []);
    
    // 设置叶子节点
    tree[0] = [...commitments];
    
    // 填充到2的幂次
    const maxLeaves = Math.pow(2, TREE_DEPTH);
    while (tree[0].length < maxLeaves) {
      tree[0].push(ZERO_VALUE);
    }
    
    console.log(`叶子节点数量: ${tree[0].length}`);
    
    // 自底向上构建树
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
    
    const merkleRoot = tree[TREE_DEPTH][0];
    console.log("计算出的Merkle根:", merkleRoot);
    
    // 验证特定叶子的Merkle证明
    if (commitments.length > 0) {
      const leafIndex = 0; // 验证第一个commitment
      const leaf = commitments[leafIndex];
      
      console.log(`\n验证叶子节点 ${leafIndex}: ${leaf}`);
      
      // 生成Merkle证明
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
      
      // 验证Merkle证明
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
      console.log("与直接计算的根是否匹配:", currentHash === merkleRoot);
    }
    
  } catch (error) {
    console.error("获取存款事件时出错:", error.message);
    console.log("使用测试数据继续...");
    
    // 使用测试数据
    const commitments = [
      "0x1234567890123456789012345678901234567890123456789012345678901234",
      "0x2345678901234567890123456789012345678901234567890123456789012345"
    ];
    
    // 使用与前端相同的逻辑构建Merkle树
    const poseidon = await buildPoseidon();
    const TREE_DEPTH = 20;
    const ZERO_VALUE = "0";
    
    // 初始化零值数组
    const zeros = [];
    let currentZero = ZERO_VALUE;
    for (let i = 0; i < TREE_DEPTH; i++) {
      zeros[i] = currentZero;
      const hash = poseidon([BigInt(currentZero), BigInt(currentZero)]);
      currentZero = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }
    
    console.log("零值计算完成");
    
    // 构建Merkle树
    let tree = Array.from({ length: TREE_DEPTH + 1 }, () => []);
    
    // 设置叶子节点
    tree[0] = [...commitments];
    
    // 填充到2的幂次
    const maxLeaves = Math.pow(2, TREE_DEPTH);
    while (tree[0].length < maxLeaves) {
      tree[0].push(ZERO_VALUE);
    }
    
    console.log(`叶子节点数量: ${tree[0].length}`);
    
    // 自底向上构建树
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
    
    const merkleRoot = tree[TREE_DEPTH][0];
    console.log("计算出的Merkle根:", merkleRoot);
  }
  
  console.log("\n=== 调试完成 ===");
  console.log("请检查以下可能的问题:");
  console.log("1. 前端获取的存款事件顺序是否与区块链一致");
  console.log("2. 前端构建的Merkle树是否与合约一致");
  console.log("3. 传递给电路的Merkle根是否正确");
}

// 运行调试
debugRealMerkleRoot().catch(console.error);