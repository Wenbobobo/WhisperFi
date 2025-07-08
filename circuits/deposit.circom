pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Computes the hash of a deposit note.
// @param secret The secret known only to the user.
// @param amount The amount of the deposit.
// @return commitment The hash of the note.
template Deposit() {
    // Private inputs
    signal input secret;
    signal input amount;

    // Public output
    signal output commitment;

    // Hash the secret and amount together to create the commitment
    component hasher = Poseidon(2);
    hasher.inputs[0] <== secret;
    hasher.inputs[1] <== amount;

    commitment <== hasher.out;
}

component main = Deposit();
