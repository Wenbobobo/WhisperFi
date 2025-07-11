const fs = require("fs");
const snarkjs = require("snarkjs");

async function debugCircuit() {
    console.log("Debug circuit inputs...");
    
    // Create minimal test inputs
    const minimalInputs = {
        secret: "1",
        amount: "1",
        merklePath: Array(20).fill("0"),
        merkleRoot: "1",
        nullifier: "1"
    };
    
    console.log("Testing minimal inputs...");
    console.log("Input keys:", Object.keys(minimalInputs));
    console.log("merklePath length:", minimalInputs.merklePath.length);
    
    try {
        // Let's try to load the WASM file manually to see what it expects
        const wasmBuffer = fs.readFileSync('./frontend/public/zk/withdraw.wasm');
        console.log("WASM file size:", wasmBuffer.length);
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            minimalInputs,
            './frontend/public/zk/withdraw.wasm',
            './frontend/public/zk/withdraw.zkey'
        );
        
        console.log("SUCCESS: Minimal inputs worked!");
        console.log("Public signals count:", publicSignals.length);
        console.log("Public signals:", publicSignals);
        
    } catch (error) {
        console.log("ERROR with minimal inputs:", error.message);
        console.log("Full error:", error);
        
        // Let's try even simpler - maybe the circuit has different signal names
        console.log("\nTrying alternative signal names...");
        const altInputs = {
            "main.secret": "1",
            "main.amount": "1", 
            "main.merklePath": Array(20).fill("0"),
            "main.merkleRoot": "1",
            "main.nullifier": "1"
        };
        
        try {
            const { proof: altProof } = await snarkjs.groth16.fullProve(
                altInputs,
                './frontend/public/zk/withdraw.wasm',
                './frontend/public/zk/withdraw.zkey'
            );
            console.log("SUCCESS with main. prefix!");
        } catch (altError) {
            console.log("ERROR with main. prefix:", altError.message);
        }
    }
}

debugCircuit().catch(console.error);
