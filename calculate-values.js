// 让我们使用circomlibjs来正确计算Poseidon哈希和Merkle根
const { buildPoseidon } = require("circomlibjs");

async function calculateCorrectValues() {
    console.log("Calculating correct values for circuit test...");
    
    const poseidon = await buildPoseidon();
    
    // 输入值
    const secret = BigInt(1);
    const amount = BigInt("100000000000000000"); // 0.1 ETH
    
    // 计算commitment
    const commitment = poseidon([secret, amount]);
    console.log("Calculated commitment:", commitment.toString());
    
    // 计算nullifier
    const nullifier = poseidon([secret]);
    console.log("Calculated nullifier:", nullifier.toString());
    
    // 计算Merkle根 - 假设commitment是最左边的叶子，其他都是0
    let currentHash = commitment;
    
    for (let level = 0; level < 20; level++) {
        // pathIndices[level] = 0 意味着当前节点是左子节点
        // 所以兄弟节点(pathElements[level])在右边
        const sibling = BigInt(0);
        currentHash = poseidon([currentHash, sibling]);
        console.log(`Level ${level}: hash = ${currentHash.toString()}`);
    }
    
    const calculatedRoot = currentHash;
    console.log("Final calculated root:", calculatedRoot.toString());
    
    // 转换为字符串格式，因为电路期望字符串输入
    const result = {
        commitment: commitment.toString(),
        nullifier: nullifier.toString(),
        merkleRoot: calculatedRoot.toString()
    };
    
    console.log("\nFinal values for circuit:");
    console.log("commitment:", result.commitment);
    console.log("nullifier:", result.nullifier);
    console.log("merkleRoot:", result.merkleRoot);
    
    return result;
}

calculateCorrectValues().catch(console.error);
