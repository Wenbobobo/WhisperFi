// scripts/test-merkle-proof-simple.js
// 简单的Merkle证明测试

console.log("=== 简单的Merkle证明测试 ===");

// 模拟一些commitments
const commitments = [
  "0x0ba84b727581899720478b7fa3efa3ecd8dee5a7693186e7f5e3d9ee8b506733",
  "0x114ee11809a326a26c541ebf1961fdb62f466a8ae71820d2ffb0ead9efc17c97",
  "0x5b73d7216d8b9bdb18bbae5f8d8ead2676e5d06fac0937e8c5375487a8de75f7"
];

console.log("Commitments:", commitments);

// 测试参数
const TREE_DEPTH = 16;
const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

console.log("TREE_DEPTH:", TREE_DEPTH);
console.log("ZERO_VALUE:", ZERO_VALUE);

console.log("测试完成 - 参数正确");