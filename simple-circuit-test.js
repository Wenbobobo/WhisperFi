const snarkjs = require("snarkjs");

async function simpleTest() {
    console.log("Simple circuit test with minimal valid inputs...");
    
    // 让我们使用一个简单但有效的测试用例
    // 计算 commitment = poseidon(secret, amount)
    // 然后构建一个简单的Merkle树验证
    
    const testInput = {
        secret: "1",
        amount: "100000000000000000", // 0.1 ETH
        pathElements: [
            "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
            "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"
        ],
        pathIndices: [
            "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
            "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"
        ],
        merkleRoot: "8908493308698473203698033306476070915542398077419263766844709838373568799775", // 正确计算的根值
        nullifier: "11804746570097988500406515880312748549061376249652932073901633969830635984160" // poseidon(1)
    };
    
    console.log("Testing with simple inputs...");
    console.log("Secret:", testInput.secret);
    console.log("Amount:", testInput.amount);
    console.log("Merkle root:", testInput.merkleRoot);
    console.log("Nullifier:", testInput.nullifier);
    
    try {
        console.log("Attempting proof generation...");
        const startTime = Date.now();
        
        const result = await snarkjs.groth16.fullProve(
            testInput,
            './public/zk/withdraw.wasm',
            './public/zk/withdraw.zkey'
        );
        
        const endTime = Date.now();
        console.log(`SUCCESS! Proof generated in ${endTime - startTime}ms`);
        console.log("Public signals:", result.publicSignals);
        
        return result;
        
    } catch (error) {
        console.error("ERROR in proof generation:");
        console.error("Type:", error.constructor.name);
        console.error("Message:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack.split('\n').slice(0, 5).join('\n'));
        }
        throw error;
    }
}

// 运行测试并处理结果
simpleTest()
    .then(() => {
        console.log("Test completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Test failed:", error.message);
        process.exit(1);
    });

// 添加超时处理
setTimeout(() => {
    console.error("Test timed out after 60 seconds");
    process.exit(1);
}, 60000);
