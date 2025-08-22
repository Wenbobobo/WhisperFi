import { ethers } from "ethers";
import { task } from "hardhat/config";

// 这个任务可以直接通过 npx hardhat run test-deposit-with-correct-commitment.ts 来运行
async function main() {
  // 连接到本地Hardhat网络
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // 使用第一个账户作为发送者
  const [owner] = await provider.listAccounts();
  const signer = await provider.getSigner(owner.address);
  
  console.log("Using account:", owner.address);
  
  // PrivacyPool合约地址
  const privacyPoolAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
  console.log("PrivacyPool Address:", privacyPoolAddress);
  
  // 创建PrivacyPool合约实例
  const privacyPool = new ethers.Contract(
    privacyPoolAddress,
    [
      "function deposit(bytes32) payable",
      "function merkleRoot() view returns (bytes32)",
      "function DEPOSIT_AMOUNT() view returns (uint256)"
    ],
    signer
  );
  
  try {
    // 获取当前的merkle root
    const initialRoot = await privacyPool.merkleRoot();
    console.log("Initial Merkle Root:", initialRoot);
    
    // 获取存款金额
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    console.log("Deposit Amount:", ethers.formatEther(depositAmount), "ETH");
    
    // 使用与前端相同的逻辑生成commitment（直接从DepositCard.tsx中复制）
    // 这是DepositCard.tsx中生成commitment的方式：
    // const newCommitment = await generateCommitment(
    //   secret,
    //   ethers.parseEther("0.1").toString()
    // );
    
    // 我们直接使用一个已知有效的commitment来测试
    // 这个commitment是使用正确的poseidon([secret, amount])生成的
    const commitment = "0x0e518400376900b1a419912b49ed15430f8033d97e4f397d848392b90c942706";
    
    console.log("Using Commitment:", commitment);
    
    // 尝试存款
    console.log("Attempting deposit...");
    const tx = await privacyPool.deposit(commitment, {
      value: depositAmount
    });
    
    console.log("Transaction sent:", tx.hash);
    
    // 等待交易确认
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    // 获取新的merkle root
    const newRoot = await privacyPool.merkleRoot();
    console.log("New Merkle Root:", newRoot);
    console.log("Root changed:", initialRoot !== newRoot);
  } catch (error: any) {
    console.error("Error during deposit:", error.message);
    if (error.reason) {
      console.error("Error reason:", error.reason);
    }
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });