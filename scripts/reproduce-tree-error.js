// scripts/reproduce-tree-error.js
// 复现Tree not initialized错误

const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

// 从frontend/src/utils/crypto.ts复制的CircuitCompatibleMerkleTree类
class CircuitCompatibleMerkleTree {
  constructor(levels, leaves, zeroValue = "0") {
    this.levels = levels;
    this.zeroValue = zeroValue;
    this.leaves = [...leaves];
    this.tree = [];
    this.zeros = [];
    this.filledSubTrees = [];
    this.merkleRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  /**
   * Initialize the tree with Poseidon hasher.
   * Must be called before using other methods.
   */
  async initialize() {
    this.poseidon = await buildPoseidon();
    
    // Initialize zeros and filledSubTrees arrays to match contract logic
    let currentZero = this.zeroValue;
    for (let i = 0; i < this.levels; i++) {
      this.zeros[i] = currentZero;
      this.filledSubTrees[i] = currentZero;
      const hash = this.poseidon([BigInt(currentZero), BigInt(currentZero)]);
      currentZero = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }
    this.merkleRoot = currentZero;
    
    // Insert all leaves incrementally to match contract logic
    for (let i = 0; i < this.leaves.length; i++) {
      await this._insertLeaf(this.leaves[i]);
    }
  }

  /**
   * Insert a leaf into the tree using the same incremental algorithm as the contract
   * @param leaf The leaf to insert
   */
  async _insertLeaf(leaf) {
    let currentIndex = this.leaves.length; // This should be the next leaf index
    let currentLevelHash = leaf;

    for (let i = 0; i < this.levels; i++) {
      if (currentIndex % 2 === 0) { // Left node
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
  }

  /**
   * Build the complete Merkle tree using circuit-compatible hashing.
   */
  async buildTree() {
    // Initialize the tree with empty arrays for each level
    this.tree = Array.from({ length: this.levels + 1 }, () => []);
    
    // Set leaves at level 0
    this.tree[0] = [...this.leaves];
    
    // Pad leaves to the next power of 2 if needed
    const maxLeaves = Math.pow(2, this.levels);
    while (this.tree[0].length < maxLeaves) {
      this.tree[0].push(this.zeroValue);
    }

    // Build tree bottom-up
    for (let level = 1; level <= this.levels; level++) {
      const currentLevel = this.tree[level];
      const previousLevel = this.tree[level - 1];
      
      for (let i = 0; i < previousLevel.length; i += 2) {
        const left = previousLevel[i];
        const right = previousLevel[i + 1] || this.zeroValue;
        
        // Use the same hashing logic as the circuit: poseidon([left, right])
        const hash = this.poseidon([BigInt(left), BigInt(right)]);
        const hashStr = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
        currentLevel.push(hashStr);
      }
    }
  }

  /**
   * Get the Merkle root (top of the tree).
   */
  getRoot() {
    return this.merkleRoot;
  }

  /**
   * Generate Merkle proof for a specific leaf, compatible with circuit format.
   * Returns pathElements and pathIndices that match the circuit's expectations.
   */
  generateProof(leafIndex) {
    if (leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} is out of bounds`);
    }

    const pathElements = [];
    const pathIndices = [];
    let currentIndex = leafIndex;

    // Generate path from leaf to root using the same logic as the contract
    for (let level = 0; level < this.levels; level++) {
      const isLeft = currentIndex % 2 === 0;
      
      if (isLeft) {
        // Left node: sibling is the right node (zeros[level] if it doesn't exist)
        pathElements.push(this.zeros[level]);
      } else {
        // Right node: sibling is the left node (filledSubTrees[level])
        pathElements.push(this.filledSubTrees[level]);
      }
      
      // Path index: 0 = current node is left, 1 = current node is right
      pathIndices.push(isLeft ? 0 : 1);
      
      // Move to parent index
      currentIndex = Math.floor(currentIndex / 2);
    }

    return { pathElements, pathIndices };
  }

  /**
   * Verify a Merkle proof manually (for testing).
   * This uses the same logic as the circuit's MerkleTreeChecker.
   */
  async verifyProof(
    leaf,
    pathElements,
    pathIndices,
    expectedRoot
  ) {
    let currentHash = leaf;

    for (let i = 0; i < pathElements.length; i++) {
      const sibling = pathElements[i];
      const isLeft = pathIndices[i] === 0;
      
      // Same logic as circuit: if pathIndices[i] = 0, current is left, sibling is right
      const left = isLeft ? currentHash : sibling;
      const right = isLeft ? sibling : currentHash;
      
      const hash = this.poseidon([BigInt(left), BigInt(right)]);
      currentHash = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }

    return currentHash === expectedRoot;
  }
}

async function reproduceTreeError() {
  console.log("=== 复现Tree not initialized错误 ===");
  
  // 模拟实际的存款commitments
  const commitments = [
    "0x1c554a5755338096179ca954068c68504101d565ebc0b9b760742695683c4657",
    "0x2d9a1f8e64b7c2d5f8a93b7e4c6d2f1e8a7b9c6d5e4f3a2b1c0d9e8f7a6b5c4d"
  ];
  
  console.log("模拟的存款commitments:", commitments);
  
  // 创建Merkle树
  console.log("\n=== 创建Merkle树 ===");
  const tree = new CircuitCompatibleMerkleTree(
    16,
    commitments,
    "5738151709701895985996174429509233181681189240650583716378205449277091542814"
  );
  
  await tree.initialize();
  
  const merkleRoot = tree.getRoot();
  console.log("Merkle根:", merkleRoot);
  
  // 尝试生成证明
  console.log("\n=== 尝试生成Merkle证明 ===");
  try {
    const leafIndex = 0; // 验证第一个commitment
    const { pathElements, pathIndices } = tree.generateProof(leafIndex);
    console.log("✅ 证明生成成功");
    console.log("路径元素数量:", pathElements.length);
    console.log("路径索引数量:", pathIndices.length);
  } catch (error) {
    console.log("❌ 证明生成失败:", error.message);
  }
}

// 运行测试
reproduceTreeError().catch(console.error);