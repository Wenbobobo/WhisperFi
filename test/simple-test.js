const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");

async function simpleTest() {
  console.log("=== Simple Circuit Test ===");

  const poseidon = await buildPoseidon();

  // Test 1: Verify the Poseidon hash calculation
  const secret = BigInt(1);
  const amount = BigInt(1);

  const commitmentResult = poseidon([secret, amount]);
  const commitment = poseidon.F.toString(commitmentResult);

  const nullifierResult = poseidon([secret]);
  const nullifier = poseidon.F.toString(nullifierResult);

  console.log("Commitment:", commitment);
  console.log("Nullifier:", nullifier);

  // Test 2: Simple Merkle path
  // If our commitment is the only leaf, and all siblings are 0
  // Root should be hash(hash(...hash(commitment, 0)..., 0), 0) 20 times

  let currentHash = BigInt(commitment);
  for (let i = 0; i < 20; i++) {
    const result = poseidon([currentHash, BigInt(0)]);
    currentHash = BigInt(poseidon.F.toString(result));
  }

  const expectedRoot = currentHash.toString();
  console.log("Expected root:", expectedRoot);

  // Test 3: Try circuit with these values
  const input = {
    secret: "1",
    amount: "1",
    pathElements: Array(20).fill("0"),
    pathIndices: Array(20).fill("0"),
    merkleRoot: expectedRoot,
    nullifier: nullifier,
  };

  console.log("Testing with computed root...");

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "./frontend/public/zk/withdraw.wasm",
      "./frontend/public/zk/withdraw.zkey"
    );

    console.log("✅ SUCCESS!");
    console.log("Public signals:", publicSignals);
  } catch (error) {
    console.log("❌ Still failed:", error.message);

    // Let's try with the old circuit format to see if that works
    console.log(
      "\nTrying even simpler - wrong nullifier to see different error..."
    );
    const wrongInput = {
      secret: "1",
      amount: "1",
      pathElements: Array(20).fill("0"),
      pathIndices: Array(20).fill("0"),
      merkleRoot: expectedRoot,
      nullifier: "999", // Wrong nullifier
    };

    try {
      await snarkjs.groth16.fullProve(
        wrongInput,
        "./frontend/public/zk/withdraw.wasm",
        "./frontend/public/zk/withdraw.zkey"
      );
      console.log("This shouldn't work...");
    } catch (err2) {
      console.log("Expected failure with wrong nullifier:", err2.message);
    }
  }
}

simpleTest().catch(console.error);
