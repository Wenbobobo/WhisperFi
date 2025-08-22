// scripts/contract-merkle-simulation.js
// 模拟合约中的Merkle树实现

const { buildPoseidon } = require("circomlibjs");

class ContractMerkleTree {
  constructor(treeDepth = 16) {
    this.TREE_DEPTH = treeDepth;
    this.nextLeafIndex = 0;
    this.filledSubTrees = new Array(treeDepth);
    this.zeros = new Array(treeDepth);
    
    // 初始化零值（与合约一致）
    const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const zeroValue = 5738151709701895985996174429509233181681189240650583716378205449277091542814n; // 计算出的ZERO_VALUE
    const zeroValueStr = "0x" + zeroValue.toString(16);
    
    for (let i = 0; i < treeDepth; i++) {
      this.zeros[i] = zeroValueStr;
      this.filledSubTrees[i] = zeroValueStr;
    }
  }

  async initialize() {
    this.poseidon = await buildPoseidon();
    // 计算最终的零值根（与合约初始化一致）
    let currentZero = this.zeros[0];
    for (let i = 0; i < this.TREE_DEPTH; i++) {
      const hash = this.poseidon([BigInt(currentZero), BigInt(currentZero)]);
      currentZero = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }
    this.merkleRoot = currentZero;
  }

  // 模拟合约中的_insertLeaf方法
  async insertLeaf(leaf) {
    if (this.nextLeafIndex >= (2 ** this.TREE_DEPTH)) {
      throw new Error("Merkle tree is full");
    }

    let currentIndex = this.nextLeafIndex;
    let currentLevelHash = leaf;

    for (let i = 0; i < this.TREE_DEPTH; i++) {
      if (currentIndex % 2 == 0) { // Left node
        this.filledSubTrees[i] = currentLevelHash;
        const hash = this.poseidon([BigInt(currentLevelHash), BigInt(this.zeros[i])]);
        currentLevelHash = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
      } else { // Right node
        const hash = this.poseidon([BigInt(this.filledSubTrees[i]), BigInt(currentLevelHash)]);
        currentLevelHash = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    this.merkleRoot = currentLevelHash;
    this.nextLeafIndex++;
    return this.merkleRoot;
  }

  getRoot() {
    return this.merkleRoot;
  }

  getNextLeafIndex() {
    return this.nextLeafIndex;
  }
}

async function simulateContractMerkleTree() {
  console.log("=== 模拟合约Merkle树实现 ===");
  
  // 使用实际的存款commitments
  const commitments = [
    "0x0ba84b727581899720478b7fa3efa3ecd8dee5a7693186e7f5e3d9ee8b506733",
    "0x114ee11809a326a26c541ebf1961fdb62f466a8ae71820d2ffb0ead9efc17c97",
    "0x5b73d7216d8b9bdb18bbae5f8d8ead2676e5d06fac0937e8c5375487a8de75f7",
    "0x0e518400376900b1a419912b49ed15430f8033d97e4f397d848392b90c942706"
  ];
  
  console.log("存款commitments:", commitments);
  
  // 创建合约Merkle树模拟（使用16层深度，与合约一致）
  const contractTree = new ContractMerkleTree(16);
  await contractTree.initialize();
  
  console.log("初始根:", contractTree.getRoot());
  
  // 逐步插入叶子节点，模拟合约行为
  for (let i = 0; i < commitments.length; i++) {
    const root = await contractTree.insertLeaf(commitments[i]);
    console.log(`插入第${i}个commitment后的根:`, root);
  }
  
  console.log("最终根:", contractTree.getRoot());
  console.log("下一个叶子索引:", contractTree.getNextLeafIndex());
  
  // 与之前测试中的合约根进行比较
  const expectedContractRoot = "0x1d1cd31f42526af1100dafab321247f8aebbae0c950b286c7bd7298c7906d50e";
  console.log("期望的合约根:", expectedContractRoot);
  console.log("根是否匹配:", contractTree.getRoot() === expectedContractRoot);
  
  return contractTree.getRoot();
}

// 运行模拟
simulateContractMerkleTree().catch(console.error);