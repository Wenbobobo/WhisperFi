const fs = require("fs");
const path = require("path");

async function analyzeCircuit() {
    console.log("Analyzing circuit files...");
    
    const wasmPath = path.join(__dirname, "frontend", "public", "zk", "withdraw.wasm");
    const zkeyPath = path.join(__dirname, "frontend", "public", "zk", "withdraw.zkey");
    
    console.log("WASM path:", wasmPath);
    console.log("ZKEY path:", zkeyPath);
    
    console.log("WASM file exists:", fs.existsSync(wasmPath));
    console.log("ZKEY file exists:", fs.existsSync(zkeyPath));
    
    if (fs.existsSync(wasmPath)) {
        const stats = fs.statSync(wasmPath);
        console.log("WASM file size:", stats.size, "bytes");
    }
    
    if (fs.existsSync(zkeyPath)) {
        const stats = fs.statSync(zkeyPath);
        console.log("ZKEY file size:", stats.size, "bytes");
    }
    
    // Check if we have the original circom files
    const circuitPath = path.join(__dirname, "circuits", "withdraw.circom");
    const newCircuitPath = path.join(__dirname, "circuits", "withdraw_new.circom");
    
    console.log("Original circuit exists:", fs.existsSync(circuitPath));
    console.log("New circuit exists:", fs.existsSync(newCircuitPath));
    
    // Look for symbol files that might give us clues
    const symFiles = [
        path.join(__dirname, "circuits", "withdraw.sym"),
        path.join(__dirname, "withdraw.sym")
    ];
    
    symFiles.forEach(symPath => {
        if (fs.existsSync(symPath)) {
            console.log("Symbol file found:", symPath);
            try {
                const content = fs.readFileSync(symPath, 'utf8');
                if (content.trim()) {
                    console.log("Symbol file content preview:", content.substring(0, 200));
                } else {
                    console.log("Symbol file is empty");
                }
            } catch (e) {
                console.log("Could not read symbol file:", e.message);
            }
        }
    });
}

analyzeCircuit();
