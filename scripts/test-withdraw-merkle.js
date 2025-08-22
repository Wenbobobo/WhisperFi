// scripts/test-withdraw-merkle.js
// 测试withdraw流程中Merkle根一致性的脚本

const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

async function testWithdrawMerkle() {
  console.log("=== Withdraw Merkle根一致性测试 ===");
  
  // 初始化Poseidon哈希函数
  const poseidon = await buildPoseidon();
  
  // 模拟实际的存款commitments（需要从区块链获取）
  const commitments = [
    "0x1c554a5755338096179ca954068c68504101d565ebc0b9b760742695683c4657",
    "0x2d9a1f8e64b7c2d5f8a93b7e4c6d2f1e8a7b9c6d5e4f3a2b1c0d9e8f7a6b5c4d"
  ];
  
  console.log("模拟的存款commitments:", commitments);
  
  // 使用与前端相同的逻辑构建Merkle树
  const TREE_DEPTH = 20;
  const ZERO_VALUE = "0";
  
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
  
  // 验证特定叶子的Merkle证明
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
  console.log("与直接计算的根是否匹配:", currentHash === frontendMerkleRoot);
  
  // 模拟传递给电路的输入
  const circuitInput = {
    secret: BigInt("123456789"),
    amount: BigInt("100000000000000000"), // 0.1 ETH in wei
    pathElements: pathElements.map(el => BigInt(el)),
    pathIndices: pathIndices,
    merkleRoot: BigInt(frontendMerkleRoot),
    nullifier: BigInt("987654321")
  };
  
  console.log("\n=== 传递给电路的输入 ===");
  console.log("Secret:", circuitInput.secret.toString());
  console.log("Amount:", circuitInput.amount.toString());
  console.log("Merkle根:", "0x" + circuitInput.merkleRoot.toString(16));
  console.log("Nullifier:", circuitInput.nullifier.toString());
  console.log("路径元素数量:", circuitInput.pathElements.length);
  console.log("路径索引数量:", circuitInput.pathIndices.length);
  
  // 模拟从电路返回的publicSignals
  const publicSignals = [
    circuitInput.merkleRoot.toString(),
    circuitInput.nullifier.toString()
  ];
  
  console.log("\n=== 从电路返回的publicSignals ===");
  console.log("Public Signals:", publicSignals);
  
  // 模拟handleWithdraw中处理publicSignals的逻辑
  console.log("\n=== handleWithdraw处理逻辑 ===");
  const rootFromSignal = BigInt(publicSignals[0]);
  const nullifierFromSignal = BigInt(publicSignals[1]);
  
  const rootBytes32 = ethers.toBeHex(rootFromSignal, 32);
  const nullifierBytes32 = ethers.toBeHex(nullifierFromSignal, 32);
  
  console.log("Merkle Root (来自信号):", rootFromSignal.toString());
  console.log("格式化后的 Merkle Root (bytes32):", rootBytes32);
  console.log("Nullifier Hash (来自信号):", nullifierFromSignal.toString());
  console.log("格式化后的 Nullifier Hash (bytes32):", nullifierBytes32);
  
  // 检查可能的问题
  console.log("\n=== 一致性检查 ===");
  console.log("1. 前端Merkle根 === 电路输入Merkle根:", frontendMerkleRoot === "0x" + circuitInput.merkleRoot.toString(16));
  console.log("2. 电路输入Merkle根 === publicSignals[0]:", "0x" + circuitInput.merkleRoot.toString(16) === rootBytes32);
  
  console.log("\n=== 测试完成 ===");
  console.log("如果以上检查都通过，但仍然出现'Invalid Merkle root'错误，可能的原因:");
  console.log("1. 合约中存储的Merkle根与前端计算的不同");
  console.log("2. 存款事件获取顺序不正确");
  console.log("3. 合约中的Merkle树构建逻辑与前端不一致");
}

// 运行测试
testWithdrawMerkle().catch(console.error);