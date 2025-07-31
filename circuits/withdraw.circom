pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input enabled;

    component hashers[levels];
    signal hashes[levels + 1];
    hashes[0] <== leaf;
    
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
        hashers[i].inputs[1] <== pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);
        hashes[i + 1] <== hashers[i].out;
    }
    
    component rootCheck = ForceEqualIfEnabled();
    rootCheck.enabled <== enabled;
    rootCheck.in[0] <== hashes[levels];
    rootCheck.in[1] <== root;
}


// A simple withdrawal circuit for baseline testing
template Withdraw(levels) {
    // Private inputs
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Public inputs
    signal input merkleRoot;
    signal input nullifier;
    
    // Public output
    signal output publicInputsHash;

    // 1. Calculate nullifier from secret
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== secret;
    signal calculatedNullifier <== nullifierHasher.out;

    // 2. Constrain the public nullifier
    nullifier === calculatedNullifier;

    // 3. Calculate commitment from secret
    component commitmentHasher = Poseidon(1);
    commitmentHasher.inputs[0] <== secret;
    signal commitment <== commitmentHasher.out;

    // 4. Verify Merkle proof
    component merkleProof = MerkleTreeChecker(levels);
    merkleProof.leaf <== commitment;
    merkleProof.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }
    merkleProof.enabled <== 1;
    
    // 5. Calculate public inputs hash
    component publicHasher = Poseidon(2);
    publicHasher.inputs[0] <== merkleRoot;
    publicHasher.inputs[1] <== calculatedNullifier;
    publicInputsHash <== publicHasher.out;
}

component main = Withdraw(20);