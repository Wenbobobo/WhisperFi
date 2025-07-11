const { ethers } = require("hardhat");

async function main() {
    // 获取合约实例
    const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
    const privacyPool = PrivacyPool.attach("0xc6e7DF5E7b4f2A278906862b61205850344D4e7d");
    
    // 查询当前的root
    const currentRoot = await privacyPool.root();
    console.log("Current contract root:", currentRoot);
    console.log("Current root (hex):", currentRoot);
    
    // 查询合约余额
    const balance = await ethers.provider.getBalance(privacyPool.target);
    console.log("Contract balance:", ethers.formatEther(balance), "ETH");
    
    // 查询最新的区块号
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log("Latest block number:", blockNumber);
    
    // 查询所有Deposit事件
    const filter = privacyPool.filters.Deposit();
    const events = await privacyPool.queryFilter(filter, 0, blockNumber);
    console.log("Total deposit events:", events.length);
    
    if (events.length > 0) {
        console.log("Latest deposit:", {
            commitment: events[events.length - 1].args.commitment,
            leafIndex: events[events.length - 1].args.leafIndex.toString(),
            blockNumber: events[events.length - 1].blockNumber
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
