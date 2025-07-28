import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";

// 简单的前端Poseidon测试
async function testFrontendPoseidon() {
  console.log("=== 前端Poseidon哈希测试 ===\n");

  const poseidon = await buildPoseidon();

  // 测试一些已知值
  const testCases = [
    [BigInt(1), BigInt(2)],
    [BigInt(0), BigInt(0)],
    [BigInt(123456789), BigInt(987654321)],
    [
      BigInt(
        "8175042333908131853555108599311849679722172756805630201899011284758317870395"
      ),
      BigInt(0),
    ], // 从log中的commitment
  ];

  for (let i = 0; i < testCases.length; i++) {
    const [left, right] = testCases[i];
    const result = poseidon([left, right]);
    const resultString = poseidon.F.toString(result);

    console.log(`测试用例 ${i + 1}:`);
    console.log(`  输入: [${left.toString()}, ${right.toString()}]`);
    console.log(`  输出: ${resultString}`);
    console.log(`  输出(hex): 0x${BigInt(resultString).toString(16)}`);
    console.log("");
  }
}

// 测试Merkle树构建逻辑
async function testMerkleTreeConstruction() {
  console.log("=== Merkle树构建测试 ===\n");

  const poseidon = await buildPoseidon();

  // 从log中获取的实际commitment
  const commitment =
    "8175042333908131853555108599311849679722172756805630201899011284758317870395";

  console.log(`叶子节点 (commitment): ${commitment}`);
  console.log("");

  // 模拟20层Merkle树的构建过程
  let currentHash = BigInt(commitment);
  console.log("手动Merkle树构建过程:");
  console.log(`Level 0 (叶子): ${currentHash.toString()}`);

  for (let level = 0; level < 20; level++) {
    // 在单个元素的树中，我们需要与零值配对
    const zeroValue = BigInt(0);

    // 对于单个叶子节点，它总是作为左子节点，右边是零值
    const nextHash = poseidon([currentHash, zeroValue]);
    currentHash = BigInt(poseidon.F.toString(nextHash));

    console.log(`Level ${level + 1}: ${currentHash.toString()}`);

    if (level < 5) {
      // 只显示前几层避免输出过长
      console.log(
        `  计算: poseidon([${
          level === 0 ? commitment : "previous"
        }, 0]) = ${currentHash.toString()}`
      );
    }
  }

  console.log(`\n最终根节点: ${currentHash.toString()}`);
  console.log(`根节点(hex): 0x${currentHash.toString(16)}`);
}

async function main() {
  try {
    await testFrontendPoseidon();
    await testMerkleTreeConstruction();
  } catch (error) {
    console.error("测试失败:", error);
  }
}

main();
