// scripts/reproduce-withdraw-error-accurate.js
// 准确复现withdraw功能中的"Merkle根不匹配"错误

const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

// 合约中的Merkle树实现（模拟）
class ContractMerkleTree {
  constructor(treeDepth = 16) {
    this.TREE_DEPTH = treeDepth;
    this.nextLeafIndex = 0;
    this.filledSubTrees = new Array(treeDepth);
    this.zeros = new Array(treeDepth);
    
    // 初始化零值
    const poseidon = buildPoseidon();
    let currentZero = "0"; // 合约中使用的是keccak256("PrivacyPool-Zero") % SNARK_SCALAR_FIELD，这里简化为"0"
    for (let i = 0; i < treeDepth; i++) {
      this.zeros[i] = currentZero;
      this.filledSubTrees[i] = currentZero;
      const hash = poseidon([BigInt(currentZero), BigInt(currentZero)]);
      currentZero = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }
    this.merkleRoot = currentZero;
  }

  // 模拟合约中的_insertLeaf方法
  insertLeaf(leaf) {
    if (this.nextLeafIndex >= (2 ** this.TREE_DEPTH)) {
      throw new Error("Merkle tree is full");
    }

    let currentIndex = this.nextLeafIndex;
    let currentLevelHash = leaf;
    const poseidon = buildPoseidon();

    for (let i = 0; i < this.TREE_DEPTH; i++) {
      if (currentIndex % 2 == 0) { // Left node
        this.filledSubTrees[i] = currentLevelHash;
        const hash = poseidon([BigInt(currentLevelHash), BigInt(this.zeros[i])]);
        currentLevelHash = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
      } else { // Right node
        const hash = poseidon([BigInt(this.filledSubTrees[i]), BigInt(currentLevelHash)]);
        currentLevelHash = "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    this.merkleRoot = currentLevelHash;
    this.nextLeafIndex++;
  }

  getRoot() {
    return this.merkleRoot;
  }
}

// 前端中的Merkle树实现（有缺陷的版本）
class FrontendMerkleTree {
  constructor(levels, leaves, zeroValue = "0") {
    this.levels = levels;
    this.zeroValue = zeroValue;
    this.leaves = [...leaves];
    this.tree = [];
  }

  async initialize() {
    this.poseidon = await buildPoseidon();
    await this.buildTree();
  }

  // 有缺陷的buildTree实现（复现问题）
  async buildTree() {
    // 初始化树，每个层级都是空数组
    this.tree = Array.from({ length: this.levels + 1 }, () => []);
    
    // 在第0层设置叶子节点
    this.tree[0] = [...this.leaves];
    
    // 填充到2的幂次（但这里实现可能有问题）
    const maxLeaves = Math.pow(2, this.levels);
    while (this.tree[0].length < maxLeaves) {
      this.tree[0].push(this.zeroValue);
    }
    
    // 构建树（自底向上）
    for (let level = 1; level <= this.levels; level++) {
      const currentLevel = this.tree[level];
      const previousLevel = this.tree[level - 1];
      
      // 问题：这里没有正确处理奇数个节点的情况
      // 如果previousLevel有奇数个节点，最后一个节点没有兄弟节点
      for (let i = 0; i < previousLevel.length; i += 2) {
        const left = previousLevel[i];
        // 错误：这里直接使用i+1，但没有检查是否超出边界
        const right = previousLevel[i + 1]; // 可能是undefined
        
        // 使用与电路相同的哈希逻辑：poseidon([left, right])
        const hash = this.poseidon([BigInt(left), BigInt(right || this.zeroValue)]);
        const hashStr = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
        currentLevel.push(hashStr);
      }
    }
  }

  getRoot() {
    if (!this.tree || this.tree.length === 0) {
      throw new Error("Tree not initialized. Call initialize() first.");
    }
    return this.tree[this.levels][0];
  }
}

async function reproduceWithdrawErrorAccurate() {
  console.log("=== 准确复现Withdraw Merkle根不匹配错误 ===");
  
  // 模拟实际的存款commitments（需要从区块链获取）
  const commitments = [
    "0x1c554a5755338096179ca954068c68504101d565ebc0b9b760742695683c4657",
    "0x2d9a1f8e64b7c2d5f8a93b7e4c6d2f1e8a7b9c6d5e4f3a2b1c0d9e8f7a6b5c4d"
  ];
  
  console.log("模拟的存款commitments:", commitments);
  
  // 使用合约方式逐步插入叶子节点
  console.log("\n=== 合约Merkle树构建 ===");
  const contractTree = new ContractMerkleTree(20); // 使用20层深度匹配前端
  console.log("初始根:", contractTree.getRoot());
  
  for (let i = 0; i < commitments.length; i++) {
    contractTree.insertLeaf(commitments[i]);
    console.log(`插入第${i}个commitment后的根:`, contractTree.getRoot());
  }
  
  const contractMerkleRoot = contractTree.getRoot();
  console.log("合约最终Merkle根:", contractMerkleRoot);
  
  // 使用前端方式一次性构建整个树
  console.log("\n=== 前端Merkle树构建 ===");
  const frontendTree = new FrontendMerkleTree(20, commitments);
  await frontendTree.initialize();
  
  const frontendMerkleRoot = frontendTree.getRoot();
  console.log("前端Merkle根:", frontendMerkleRoot);
  
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
  const leafIndex = 0; // 验证第一个commitment
  const leaf = commitments[leafIndex];
  
  console.log(`\n验证叶子节点 ${leafIndex}: ${leaf}`);
  
  // 生成Merkle证明
  const { pathElements, pathIndices } = frontendTree.generateProof(leafIndex);
  
  console.log("路径元素(前5个):", pathElements.slice(0, 5));
  console.log("路径索引(前5个):", pathIndices.slice(0, 5));
  
  // 验证Merkle证明
  const poseidon = await buildPoseidon();
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
  
  // 检查可能的问题
  console.log("\n=== 问题检查清单 ===");
  console.log("1. 树深度一致性: 前端(20) === 电路(20) === 合约(16)");
  console.log("2. 零值一致性: 前端 === 合约");
  console.log("3. 哈希函数一致性: 前端(circomlibjs) === 电路(circomlib) === 合约(circomlibjs)");
  console.log("4. 叶子节点顺序: 区块链事件顺序 === 前端构建顺序");
  console.log("5. 数据类型一致性: 所有地方都使用相同的格式(BigInt/bytes32)");
  
  return {
    contractMerkleRoot,
    frontendMerkleRoot,
    pathElements,
    pathIndices
  };
}

// 为FrontendMerkleTree添加generateProof方法
FrontendMerkleTree.prototype.generateProof = function(leafIndex) {
  if (!this.tree || this.tree.length === 0) {
    throw new Error("Tree not initialized. Call initialize() first.");
  }

  if (leafIndex >= this.leaves.length) {
    throw new Error(`Leaf index ${leafIndex} is out of bounds`);
  }

  const pathElements = [];
  const pathIndices = [];
  let currentIndex = leafIndex;

  // 从叶子节点到根生成路径
  for (let level = 0; level < this.levels; level++) {
    const isLeft = currentIndex % 2 === 0;
    const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
    
    // 获取兄弟节点元素（或零值如果不存在）
    const sibling = this.tree[level][siblingIndex] || this.zeroValue;
    pathElements.push(sibling);
    
    // 路径索引：0 = 当前节点是左节点，1 = 当前节点是右节点
    pathIndices.push(isLeft ? 0 : 1);
    
    // 移动到父节点索引
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { pathElements, pathIndices };
};

// 运行测试
reproduceWithdrawErrorAccurate().catch(console.error);