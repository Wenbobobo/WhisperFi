pragma circom 2.0.0;

include "./poseidon.circom";

// Verifies that a leaf is part of a Merkle tree.
// @param levels The number of levels in the tree.
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input path[levels];
    signal input enabled;

    component hashers[levels];
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
    }

    signal current_hash <== leaf;

    for (var i = 0; i < levels; i++) {
        // path[i] is 0 for left, 1 for right
        hashers[i].inputs[0] <== current_hash;
        hashers[i].inputs[1] <== path[i];
        current_hash <== hashers[i].out;
    }

    root === current_hash;
    enabled === 1;
}
