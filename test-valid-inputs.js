const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");

async function testValidInputs() {
  console.log("=== Testing Valid Circuit Inputs ===\n");

  // Initialize Poseidon
  const poseidon = await buildPoseidon();

  // Create valid test data
  const secret = "12345";
  const amount = "100000000000000000"; // 0.1 ETH in wei

  // Calculate commitment
  const commitmentResult = poseidon([BigInt(secret), BigInt(amount)]);
  const commitment = poseidon.F.toString(commitmentResult);

  // Calculate nullifier
  const nullifierResult = poseidon([BigInt(secret)]);
  const nullifier = poseidon.F.toString(nullifierResult);

  console.log("1. Generated values:");
  console.log("   Secret:", secret);
  console.log("   Amount:", amount);
  console.log("   Commitment:", commitment);
  console.log("   Nullifier:", nullifier);

  // Create a simple Merkle tree with just this commitment
  // For level 0: just the commitment itself
  // For level 1: hash(commitment, 0)
  // For level 2: hash(hash(commitment, 0), 0)
  // ... and so on

  let currentHash = BigInt(commitment);
  const pathElements = [];
  const pathIndices = [];

  for (let i = 0; i < 20; i++) {
    // For simplicity, always put our commitment on the left (index 0)
    // So sibling is always 0
    pathElements.push("0");
    pathIndices.push(0);

    // Calculate next level hash: hash(currentHash, 0)
    const nextResult = poseidon([currentHash, BigInt(0)]);
    currentHash = BigInt(poseidon.F.toString(nextResult));
  }

  const merkleRoot = currentHash.toString();

  console.log("\n2. Merkle tree info:");
  console.log("   Root:", merkleRoot);
  console.log("   Path elements (first 3):", pathElements.slice(0, 3));
  console.log("   Path indices (first 3):", pathIndices.slice(0, 3));

  // Verify manually
  console.log("\n3. Manual verification:");
  let verifyHash = BigInt(commitment);
  console.log("   Starting with commitment:", verifyHash.toString());

  for (let i = 0; i < 3; i++) {
    // Just show first 3 levels
    const pathElement = BigInt(pathElements[i]);
    const pathIndex = pathIndices[i];

    const left = pathIndex === 0 ? verifyHash : pathElement;
    const right = pathIndex === 0 ? pathElement : verifyHash;

    const result = poseidon([left, right]);
    verifyHash = BigInt(poseidon.F.toString(result));

    console.log(
      `   Level ${i}: hash(${left.toString().substring(0, 10)}..., ${right
        .toString()
        .substring(0, 10)}...) = ${verifyHash.toString().substring(0, 10)}...`
    );
  }

  // Create circuit input
  const input = {
    secret: secret,
    amount: amount,
    pathElements: pathElements,
    pathIndices: pathIndices.map((i) => i.toString()),
    merkleRoot: merkleRoot,
    nullifier: nullifier,
  };

  console.log("\n4. Circuit input prepared:");
  console.log("   Input keys:", Object.keys(input));
  console.log(
    "   All values are strings:",
    Object.values(input).every(
      (v) =>
        typeof v === "string" ||
        (Array.isArray(v) && v.every((x) => typeof x === "string"))
    )
  );

  try {
    console.log("\n5. Running circuit...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "./frontend/public/zk/withdraw.wasm",
      "./frontend/public/zk/withdraw.zkey"
    );

    console.log("✅ SUCCESS! Circuit execution completed!");
    console.log("   Public signals count:", publicSignals.length);
    console.log("   Public signals:", publicSignals);
    console.log("   Proof generated successfully");

    return true;
  } catch (error) {
    console.log("❌ FAILED! Circuit execution error:");
    console.log("   Error:", error.message);

    // Try to understand which constraint failed
    if (error.message.includes("ForceEqualIfEnabled")) {
      console.log("\n   Analysis: ForceEqualIfEnabled constraint failed");
      console.log("   This suggests the Merkle root verification failed");
      console.log("   Expected root:", merkleRoot);
      console.log("   But circuit computed a different root");
    }

    return false;
  }
}

testValidInputs().catch(console.error);
