// scripts/test-withdraw.ts
import { ethers } from "ethers";
import { groth16 } from "snarkjs";
import { CircuitCompatibleMerkleTree } from "../frontend/src/utils/crypto";

// 这个脚本用于测试withdraw功能，模拟前端的完整流程

async function testWithdraw() {
  console.log("=== Withdraw Test Script ===");
  
  // 1. 模拟从deposit获得的note
  // 这是一个真实的note示例
  const note = "private-defi-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890-v1";
  console.log("Using note:", note);
  
  // 2. 解析note
  const parts = note.split("-");
  if (parts.length !== 5 || parts[0] !== "private" || parts[1] !== "defi") {
    throw new Error(
      "Invalid note format. Expected format: private-defi-<secret>-<nullifier>-v1"
    );
  }
  const secret = "0x" + parts[2];
  const nullifier = "0x" + parts[3];
  console.log("Parsed secret:", secret);
  console.log("Parsed nullifier:", nullifier);
  
  // 3. 生成commitment
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const depositAmount = ethers.parseEther("0.1").toString();
  console.log("Deposit amount:", depositAmount);
  
  // 生成commitment的逻辑
  const secretValue = secret.startsWith("0x") ? secret : "0x" + secret;
  const commitmentHash = poseidon([BigInt(secretValue), BigInt(depositAmount)]);
  const commitment = "0x" + poseidon.F.toObject(commitmentHash).toString(16).padStart(64, "0");
  console.log("Generated commitment:", commitment);
  
  // 4. 生成nullifier hash
  const nullifierHashObj = poseidon([BigInt(secret)]);
  const nullifierHash = "0x" + poseidon.F.toObject(nullifierHashObj).toString(16).padStart(64, "0");
  console.log("Generated nullifier hash:", nullifierHash);
  
  // 5. 模拟Merkle tree（使用已知的deposit事件）
  // 这里我们使用一个已知的commitment列表来构建Merkle tree
  const commitments = [
    commitment, // 我们的commitment
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // 其他commitment
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"  // 其他commitment
  ];
  
  console.log("Building Merkle tree with commitments:", commitments);
  
  // 构建Merkle tree
  const tree = new CircuitCompatibleMerkleTree(
    20,
    commitments,
    "21663839004416932945382355908790599225266501822907911457504978515578255421292"
  );
  await tree.initialize();
  
  const merkleRoot = tree.getRoot();
  console.log("Merkle root:", merkleRoot);
  
  // 6. 找到leaf index并生成proof
  const leafIndex = commitments.findIndex((c) => c === commitment);
  if (leafIndex < 0) {
    throw new Error("Commitment not found in Merkle tree");
  }
  console.log("Leaf index:", leafIndex);
  
  const { pathElements, pathIndices } = tree.generateProof(leafIndex);
  console.log("Path elements:", pathElements);
  console.log("Path indices:", pathIndices);
  
  // 7. 准备电路输入
  console.log("Preparing circuit inputs...");
  const input = {
    // 私有输入
    secret: BigInt(secret),
    amount: BigInt(depositAmount),
    pathElements: pathElements.map(el => BigInt(el)),
    pathIndices: pathIndices,
    // 公共输入
    merkleRoot: BigInt(merkleRoot),
    nullifier: BigInt(nullifierHash)
  };
  
  console.log("Circuit inputs:", {
    secret: input.secret.toString(),
    amount: input.amount.toString(),
    pathElements: input.pathElements.map(el => el.toString()),
    pathIndices: input.pathIndices,
    merkleRoot: input.merkleRoot.toString(),
    nullifier: input.nullifier.toString(),
  });
  
  // 8. 生成ZK proof（这一步需要实际的wasm和zkey文件）
  try {
    console.log("Generating ZK proof...");
    // 注意：这需要实际的文件存在
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      "./public/zk/withdraw.wasm",
      "./public/zk/withdraw.zkey"
    );
    
    console.log("Proof generated successfully!");
    console.log("Proof:", JSON.stringify(proof));
    console.log("Public signals:", publicSignals);
    
    // 9. 格式化proof用于合约调用
    const formattedProof = {
      a: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
      b: [
        [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
        [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()],
      ],
      c: [proof.pi_c[0].toString(), proof.pi_c[1].toString()],
    };
    
    console.log("Formatted proof:", formattedProof);
    
    // 10. 格式化public signals
    const rootFromSignal = BigInt(publicSignals[0]);
    const nullifierFromSignal = BigInt(publicSignals[1]);
    
    const rootBytes32 = ethers.toBeHex(rootFromSignal, 32);
    const nullifierBytes32 = ethers.toBeHex(nullifierFromSignal, 32);
    
    console.log("Root from signal:", rootBytes32);
    console.log("Nullifier from signal:", nullifierBytes32);
    
    // 11. 准备合约调用参数
    const finalArgs = [
      formattedProof.a,
      formattedProof.b,
      formattedProof.c,
      rootBytes32,
      nullifierBytes32,
      "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // recipient address
      BigInt(0), // fee
      "0x0000000000000000000000000000000000000000", // relayer
    ];
    
    console.log("Final arguments for contract call:", finalArgs);
    
  } catch (error) {
    console.error("Error generating proof:", error);
    // 如果文件不存在，这是预期的错误，我们继续执行其他检查
  }
  
  console.log("=== Test completed ===");
}

// 运行测试
testWithdraw().catch(console.error);