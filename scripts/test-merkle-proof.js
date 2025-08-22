// scripts/test-merkle-proof.js
// 测试Merkle证明生成

const { CircuitCompatibleMerkleTree } = require("../frontend/src/utils/crypto");

async function main() {
  try {
    console.log("=== 测试Merkle证明生成 ===");
    
    // 模拟一些commitments
    const commitments = [
      "0x0ba84b727581899720478b7fa3efa3ecd8dee5a7693186e7f5e3d9ee8b506733",
      "0x114ee11809a326a26c541ebf1961fdb62f466a8ae71820d2ffb0ead9efc17c97",
      "0x5b73d7216d8b9bdb18bbae5f8d8ead2676e5d06fac0937e8c5375487a8de75f7"
    ];
    
    console.log("创建Merkle树...");
    const tree = new CircuitCompatibleMerkleTree(
      16, // TREE_DEPTH
      commitments,
      "5738151709701895985996174429509233181681189240650583716378205449277091542814" // ZERO_VALUE
    );
    
    console.log("初始化Merkle树...");
    await tree.initialize();
    console.log("Merkle树初始化完成");
    
    const merkleRoot = tree.getRoot();
    console.log("Merkle根:", merkleRoot);
    
    // 测试生成证明
    const leafIndex = 0; // 为第一个叶子节点生成证明
    console.log(`为叶子节点 ${leafIndex} 生成证明...`);
    const { pathElements, pathIndices } = tree.generateProof(leafIndex);
    console.log("证明生成成功");
    console.log("路径元素数量:", pathElements.length);
    console.log("路径索引数量:", pathIndices.length);
    console.log("路径元素:", pathElements);
    console.log("路径索引:", pathIndices);
    
  } catch (error) {
    console.error("测试过程中出现错误:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };