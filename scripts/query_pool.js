const { ethers } = require("hardhat");

async function main() {
    // 连接到本地 Hardhat 网络节点
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    
    const contractAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
    const contractABI = require("../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json").abi;
    
    // 使用一个默认的账户来查询合约
    const signer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat 默认的第一个账户私钥
        provider
    );
    
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    console.log("=== 合约诊断信息 ===");
    
    try {
        const nextLeafIndex = await contract.nextLeafIndex();
        console.log("Next Leaf Index:", nextLeafIndex.toString());
    } catch (error) {
        console.error("Error getting nextLeafIndex:", error.message);
    }
    
    try {
        const merkleRoot = await contract.merkleRoot();
        console.log("Current Merkle Root:", merkleRoot);
    } catch (error) {
        console.error("Error getting merkleRoot:", error.message);
    }
    
    // 假设我们从前端获取的 proofRoot 是 "0x2c7d431f7f7405f42a1cd8e9d13d0506a29bc151da7b571ebdb124ecc0379a4d"
    const proofRoot = "0x2c7d431f7f7405f42a1cd8e9d13d0506a29bc151da7b571ebdb124ecc0379a4d";
    
    try {
        const isValidRoot = await contract.rootHistory(proofRoot);
        console.log("Is proofRoot valid?", isValidRoot);
    } catch (error) {
        console.error("Error checking rootHistory:", error.message);
    }
    
    // 尝试获取一些存款事件，看看是否有存款记录
    try {
        const depositFilter = contract.filters.Deposit();
        const depositEvents = await contract.queryFilter(depositFilter, 0, "latest");
        console.log("Number of deposit events:", depositEvents.length);
        for (let i = 0; i < depositEvents.length; i++) {
            console.log(`Deposit event ${i + 1}:`);
            console.log("  Event object:", JSON.stringify(depositEvents[i], null, 2));
        }
    } catch (error) {
        console.error("Error querying deposit events:", error.message);
    }
    
    console.log("==================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});