const snarkjs = require("snarkjs");

async function debugCircuit() {
    console.log("Debugging circuit with step-by-step validation...");
    
    // 首先测试一个非常基本的情况
    // secret = 0, amount = 0, 所有路径都是0, root应该是什么？
    
    try {
        // 最简单的测试用例：所有输入都是0或1
        const basicInput = {
            secret: "0",
            amount: "0", 
            pathElements: Array(20).fill("0"),
            pathIndices: Array(20).fill("0"),
            merkleRoot: "0", // poseidon(0, 0) 的20层结果
            nullifier: "0" // poseidon(0)
        };
        
        console.log("Testing with all zeros...");
        await testInput(basicInput, "All zeros");
        
    } catch (error) {
        console.log("All zeros test failed:", error.message);
    }
    
    // 然后尝试禁用Merkle检查
    try {
        // 修改电路，暂时禁用Merkle验证
        const disabledInput = {
            secret: "1",
            amount: "1", 
            pathElements: Array(20).fill("0"),
            pathIndices: Array(20).fill("0"),
            merkleRoot: "999999", // 任意值，因为我们禁用检查
            nullifier: "11804746570097988500406515880312748549061376249652932073901633969830635984160" // poseidon(1)
        };
        
        console.log("Testing with disabled merkle check (if possible)...");
        // 这需要修改电路，将 enabled 设为 0
        // 但我们当前的电路总是将enabled设为1
        
    } catch (error) {
        console.log("Disabled check test failed:", error.message);
    }
}

async function testInput(input, description) {
    console.log(`\n=== Testing: ${description} ===`);
    console.log("Input:", JSON.stringify(input, null, 2));
    
    const startTime = Date.now();
    const result = await snarkjs.groth16.fullProve(
        input,
        './public/zk/withdraw.wasm',
        './public/zk/withdraw.zkey'
    );
    const endTime = Date.now();
    
    console.log(`SUCCESS: ${description} - Generated in ${endTime - startTime}ms`);
    console.log("Public signals:", result.publicSignals);
    return result;
}

debugCircuit().catch(error => {
    console.error("Debug failed:", error.message);
    process.exit(1);
});
