import { ethers } from "ethers";
import { task } from "hardhat/config";

// 这个任务可以直接通过 npx hardhat run get-contract-info.ts 来运行
async function main() {
  // 连接到本地Hardhat网络
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // 获取网络信息
  const network = await provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  
  // 获取区块信息
  const blockNumber = await provider.getBlockNumber();
  console.log("Current Block Number:", blockNumber);
  
  // 获取账户信息
  const accounts = await provider.listAccounts();
  console.log("Available Accounts:");
  accounts.forEach((account, index) => {
    console.log(`  ${index}: ${account.address}`);
  });
  
  // 尝试获取已部署的合约信息
  console.log("\nTrying to get contract information...");
  
  // PrivacyPool合约地址（从前端配置文件中获取）
  const privacyPoolAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
  console.log("PrivacyPool Address:", privacyPoolAddress);
  
  try {
    // 尝试获取PrivacyPool合约信息
    const privacyPool = new ethers.Contract(
      privacyPoolAddress,
      [
        "function merkleRoot() view returns (bytes32)",
        "function poseidonHasher() view returns (address)",
        "function verifier() view returns (address)",
        "function DEPOSIT_AMOUNT() view returns (uint256)"
      ],
      provider
    );
    
    const merkleRoot = await privacyPool.merkleRoot();
    console.log("Current Merkle Root:", merkleRoot);
    
    const poseidonHasher = await privacyPool.poseidonHasher();
    console.log("Poseidon Hasher Address:", poseidonHasher);
    
    const verifier = await privacyPool.verifier();
    console.log("Verifier Address:", verifier);
    
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    console.log("Deposit Amount:", ethers.formatEther(depositAmount), "ETH");
  } catch (error: any) {
    console.error("Error getting PrivacyPool info:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });