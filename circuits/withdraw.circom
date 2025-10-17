pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Withdrawal circuit aligned with on-chain contract (TREE_DEPTH=16)
template Withdraw(levels) {
    // Private inputs
    signal input secret;
    signal input amount; // fixed deposit amount (e.g., 0.1 ETH in wei)
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Single public output (hash of merkleRoot and nullifier)
    signal output publicInputsHash;

    // 1. Calculate nullifier from secret using Poseidon(2) with zero padding to match on-chain hasher
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== 0;
    signal calculatedNullifier <== nullifierHasher.out;

    // 2. Calculate commitment from secret and amount using Poseidon(2)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== amount;
    signal commitment <== commitmentHasher.out;

    // 3. Recompute Merkle root from path (circuit-compatible ordering)
    signal currentHash <== commitment;
    for (var i = 0; i < levels; i++) {
        component h = Poseidon(2);
        // pathIndices[i] = 0 means current on left; 1 means current on right
        h.inputs[0] <== currentHash + pathIndices[i] * (pathElements[i] - currentHash);
        h.inputs[1] <== pathElements[i] + pathIndices[i] * (currentHash - pathElements[i]);
        currentHash <== h.out;
    }

    // 4. Calculate public inputs hash = Poseidon(2)(merkleRootComputed, nullifier)
    component publicHasher = Poseidon(2);
    publicHasher.inputs[0] <== currentHash;
    publicHasher.inputs[1] <== calculatedNullifier;
    publicInputsHash <== publicHasher.out;
}

// Match the on-chain tree depth (16)
component main = Withdraw(16);
