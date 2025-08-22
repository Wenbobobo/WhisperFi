// scripts/debug-merkle-root.js
// 调试Merkle根不匹配问题的脚本

const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

async function debugMerkleRoot() {
  console.log("=== Merkle Root Debugging ===");
  
  // 初始化Poseidon哈希函数
  const poseidon = await buildPoseidon();
  
  // 模拟一些存款commitment
  const commitments = [
    "0x1234567890123456789012345678901234567890123456789012345678901234",
    "0x2345678901234567890123456789012345678901234567890123456789012345",
    "0x3456789012345678901234567890123456789012345678901234567890123456"
  ];
  
  console.log("模拟的存款commitments:", commitments);
  
  // 使用与合约相同的逻辑构建Merkle树
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
    
    console.log(`第${level}层节点数量: ${currentLevel.length}`);
  }
  
  const merkleRoot = tree[TREE_DEPTH][0];
  console.log("计算出的Merkle根:", merkleRoot);
  
  // 验证特定叶子的Merkle证明
  const leafIndex = 1; // 验证第二个commitment
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
  
  console.log("路径元素:", pathElements.slice(0, 5), "..."); // 只显示前5个
  console.log("路径索引:", pathIndices.slice(0, 5), "..."); // 只显示前5个
  
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
  
  // 检查可能的问题
  console.log("\n=== 问题检查 ===");
  console.log("1. 哈希函数一致性: 确保前端、合约和电路使用相同的Poseidon实现");
  console.log("2. 树深度一致性: 确保前端和电路使用相同的树深度(20)");
  console.log("3. 零值一致性: 确保前端和合约使用相同的零值");
  console.log("4. 叶子节点顺序: 确保从区块链获取的事件顺序正确");
  
  return {
    merkleRoot,
    pathElements,
    pathIndices
  };
}

// 运行调试
debugMerkleRoot().catch(console.error);