pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input path[levels];
    signal input enabled;

    component hashers[levels];
    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== hashes[i] + path[i] * (0 - hashes[i]);
        hashers[i].inputs[1] <== hashes[i] + (1 - path[i]) * (0 - hashes[i]);
        hashes[i + 1] <== hashers[i].out;
    }

    component rootCheck = ForceEqualIfEnabled();
    rootCheck.enabled <== enabled;
    rootCheck.in[0] <== hashes[levels];
    rootCheck.in[1] <== root;
}

template Trade(levels) {
    // --- Private Inputs ---
    signal input oldSecret;
    signal input oldAmount;
    signal input merklePath[levels];
    signal input newSecret;
    signal input newAmount;

    // --- Public Inputs ---
    signal input merkleRoot;
    signal input nullifier;
    signal input newCommitment;
    signal input tradeAmount;
    signal input recipient;
    signal input tradeDataHash;

    // --- Logic ---
    component oldCommitmentHasher = Poseidon(2);
    oldCommitmentHasher.inputs[0] <== oldSecret;
    oldCommitmentHasher.inputs[1] <== oldAmount;
    signal oldCommitment <== oldCommitmentHasher.out;

    component merkleProof = MerkleTreeChecker(levels);
    merkleProof.leaf <== oldCommitment;
    merkleProof.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        merkleProof.path[i] <== merklePath[i];
    }
    merkleProof.enabled <== 1;

    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== oldSecret;
    signal calculatedNullifier <== nullifierHasher.out;
    nullifier === calculatedNullifier;

    component newCommitmentHasher = Poseidon(2);
    newCommitmentHasher.inputs[0] <== newSecret;
    newCommitmentHasher.inputs[1] <== newAmount;
    newCommitment === newCommitmentHasher.out;

    signal totalAmount <== newAmount + tradeAmount;
    totalAmount === oldAmount;

    component tradeHasher = Poseidon(2);
    tradeHasher.inputs[0] <== recipient;
    tradeHasher.inputs[1] <== tradeAmount;
    tradeDataHash === tradeHasher.out;
}

component main = Trade(20);