# ZK-Knowledge Base: Part 4

## Our Circuits: The Heart of the Protocol

Now that we have a solid understanding of the theory behind zk-SNARKs, let's take a closer look at the specific circuits we have designed for our protocol. These circuits are the heart of our system, and they are responsible for ensuring the privacy and security of our users' transactions.

### 1. `deposit.circom`

This is the simplest circuit in our protocol. Its purpose is to take a user's private note (composed of a `secret` and an `amount`) and generate a public `commitment` hash. This commitment is then added to the Merkle tree.

**Inputs:**

-   `secret` (private): A random, secret number known only to the user.
-   `amount` (private): The amount of the deposit.

**Output:**

-   `commitment` (public): The hash of the `secret` and `amount`.

**Logic:**

The circuit uses the Poseidon hash function to compute the commitment:

`commitment = HASH(secret, amount)`

### 2. `withdraw.circom`

This circuit is used to prove that a user has the right to withdraw a specific amount from the privacy pool. It proves that the user knows the secret to a valid, unspent note in the Merkle tree.

**Inputs:**

-   `secret` (private): The secret of the note.
-   `amount` (private): The amount of the note.
-   `merklePath` (private): The path to prove the note's inclusion in the Merkle tree.
-   `merkleRoot` (public): The root of the Merkle tree.
-   `nullifier` (public): The nullifier of the note, to prevent double-spending.

**Logic:**

1.  **Calculate the commitment:** The circuit calculates the commitment from the `secret` and `amount`, just like in the `deposit` circuit.
2.  **Verify the Merkle proof:** The circuit uses the `MerkleTreeChecker` template to verify that the calculated commitment is part of the `merkleRoot`.
3.  **Calculate the nullifier:** The circuit calculates the `nullifier` from the `secret`.
4.  **Constrain the nullifier:** The circuit constrains the public `nullifier` to be equal to the calculated nullifier.

### 3. `trade.circom`

This is the most complex circuit in our protocol. It is used to prove that a user has the right to spend a note from the privacy pool to execute a trade. It is similar to the `withdraw` circuit, but with a few key differences:

-   **It consumes one old note and creates a new change note.**
-   **It authorizes a specific trade.**

**Inputs:**

-   `oldSecret` (private): The secret of the note being spent.
-   `oldAmount` (private): The amount of the note being spent.
-   `merklePath` (private): The path to prove the old note's inclusion in the Merkle tree.
-   `newSecret` (private): The secret of the new change note.
-   `newAmount` (private): The amount of the new change note.
-   `merkleRoot` (public): The root of the Merkle tree.
-   `nullifier` (public): The nullifier of the old note.
-   `newCommitment` (public): The commitment of the new change note.
-   `tradeAmount` (public): The amount being sent out for the trade.
-   `recipient` (public): The public address receiving the trade amount.
-   `tradeDataHash` (public): A hash of the trade details.

**Logic:**

1.  **Verify the old note:** The circuit verifies the old note in the same way as the `withdraw` circuit.
2.  **Verify the nullifier:** The circuit verifies the nullifier of the old note.
3.  **Verify the new commitment:** The circuit calculates the commitment of the new change note and constrains it to be equal to the public `newCommitment`.
4.  **Verify the conservation of value:** The circuit constrains the sum of the `newAmount` and `tradeAmount` to be equal to the `oldAmount`.
5.  **Constrain the trade data hash:** The circuit constrains the `tradeDatahash` to be a hash of the `recipient` and `tradeAmount`. This ensures that the proof is only valid for this specific trade.
