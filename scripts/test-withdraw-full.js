// scripts/test-withdraw-full.js
// 完整的存款到取款测试脚本

const { ethers } = require("ethers");
const { buildPoseidon } = require("circomlibjs");

async function main() {
  try {
    console.log("=== 完整的存款到取款测试 ===");
    
    // 连接到Hardhat网络
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    
    // 使用提供的测试账户
    const privateKey = "47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("测试账户地址:", wallet.address);
    
    // 获取合约地址（从部署脚本或配置文件中获取）
    const privacyPoolAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"; // 示例地址
    
    // 获取合约ABI
    const privacyPoolABI = [
      "function deposit(bytes32 commitment) payable",
      "function merkleRoot() view returns (bytes32)",
      "event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)"
    ];
    
    const privacyPool = new ethers.Contract(privacyPoolAddress, privacyPoolABI, wallet);
    
    // 1. 生成存款参数
    const poseidon = await buildPoseidon();
    const secret = ethers.toBigInt(ethers.randomBytes(31));
    const amount = ethers.parseEther("0.1");
    
    // 生成commitment
    const commitmentHash = poseidon([secret, amount]);
    const commitment = "0x" + poseidon.F.toObject(commitmentHash).toString(16).padStart(64, "0");
    console.log("生成的commitment:", commitment);
    
    // 2. 执行存款
    console.log("执行存款...");
    const depositTx = await privacyPool.deposit(commitment, {
      value: amount
    });
    
    const depositReceipt = await depositTx.wait();
    console.log("存款交易哈希:", depositReceipt.hash);
    
    // 3. 获取存款事件
    const depositEvents = await provider.getLogs({
      address: privacyPoolAddress,
      topics: [
        ethers.id("Deposit(bytes32,uint32,uint256)")
      ],
      fromBlock: "earliest"
    });
    
    console.log(`找到 ${depositEvents.length} 个存款事件`);
    
    // 4. 构建Merkle树并测试
    const { CircuitCompatibleMerkleTree } = require("../frontend/src/utils/crypto");
    
    const commitments = [];
    for (const event of depositEvents) {
      const commitment = event.topics[1]; // 第一个索引参数是commitment
      commitments.push(commitment);
      console.log(`存款commitment: ${commitment}`);
    }
    
    console.log("构建Merkle树...");
    const tree = new CircuitCompatibleMerkleTree(
      16, // TREE_DEPTH
      commitments,
      "5738151709701895985996174429509233181681189240650583716378205449277091542814" // ZERO_VALUE
    );
    
    await tree.initialize();
    console.log("Merkle树初始化完成");
    
    const merkleRoot = tree.getRoot();
    console.log("Merkle根:", merkleRoot);
    
    // 5. 测试生成证明
    const leafIndex = 0; // 假设我们要为第一个叶子节点生成证明
    console.log("生成Merkle证明...");
    const { pathElements, pathIndices } = tree.generateProof(leafIndex);
    console.log("证明生成成功");
    console.log("路径元素数量:", pathElements.length);
    console.log("路径索引数量:", pathIndices.length);
    
  } catch (error) {
    console.error("测试过程中出现错误:", error);
    process.exit(1);
  }
}

main();