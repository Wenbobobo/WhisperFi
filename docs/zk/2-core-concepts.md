# ZK-Knowledge Base: Part 2 (Revised v2)

## Core Concepts: The Cryptographic Primitives of Our Protocol

To build a functional ZKP system, we need to translate abstract concepts into concrete cryptographic primitives. Our protocol is built on three such primitives: **Commitment Schemes**, **Nullifiers**, and **Merkle Trees**.

### 1. Commitment Schemes

A commitment scheme is a cryptographic primitive that allows a party to commit to a chosen value (or statement) while keeping it hidden from others, with the ability to reveal the committed value later. It is the digital equivalent of a sealed, tamper-proof envelope.

A commitment scheme must have two key properties:

- **Hiding:** It is impossible to determine the committed value from the commitment itself.
- **Binding:** It is impossible to change the committed value once the commitment has been made.

In our protocol, we use a **hash-based commitment scheme**. A private note is defined by its `amount`, the `asset type`, and a unique, randomly generated `secret`. The commitment is the hash of these values:

`commitment = HASH(amount, asset, secret)`

- **`HASH`**: We use a ZK-friendly hash function like Poseidon. This is critical for efficiency when generating proofs.
- **`commitment`**: This is the value that is stored on-chain. It is a single, pseudorandom number that reveals nothing about the underlying data (hiding), but is uniquely determined by it (binding).

### 2. Nullifiers

A nullifier is a piece of data that is revealed when a commitment is spent, to prevent double-spending. It is a one-time-use token that is cryptographically linked to the original commitment, but in a way that does not reveal which commitment it corresponds to.

In our protocol, the nullifier is the hash of the note's unique `secret`:

`nullifier = HASH(secret)`

When a user wishes to spend a note, they must provide a ZK proof that demonstrates knowledge of a `secret` that corresponds to a valid commitment in the Merkle tree. As part of this proof, they must also reveal the `nullifier` derived from that `secret`.

The `PrivacyPool` smart contract will then:

1.  Check if the revealed `nullifier` has been used before by checking a mapping of all spent nullifiers.
2.  If it has, the transaction is a double-spend attempt and is rejected.
3.  If it is new, the contract accepts the proof and adds the `nullifier` to the set of spent nullifiers.

Because the `nullifier` is only derived from the `secret`, and not the other components of the note, it is not possible for an outside observer to link the `nullifier` to the original `commitment`. This preserves the privacy of the user's transaction history.

### 3. Merkle Trees

A Merkle tree is a binary tree of hashes that allows for efficient and secure verification of the contents of a large data set. In our protocol, we use a Merkle tree to store the set of all valid commitments.

To prove that a specific commitment is part of the tree, a user does not need to provide the entire tree. Instead, they provide a **Merkle path**, which is the set of sibling hashes along the path from the commitment (a leaf node) to the Merkle root.

The verifier (in our case, the `PrivacyPool` smart contract) can then use this Merkle path to recalculate the Merkle root. If the calculated root matches the official root stored in the contract, the commitment is proven to be a valid member of the set.

This allows us to prove that a user's note is valid and unspent, without revealing which of the thousands of notes in the tree is theirs.

### Summary: The ZKP in Action

When a user makes a private trade, they are generating a ZK proof that simultaneously proves the following statements:

1.  "I know a `secret` and an `amount` that, when hashed together, produce a `commitment` that is a valid leaf in the Merkle tree with the current `merkleRoot`."
2.  "I am revealing the correct `nullifier` for this `secret`, and this `nullifier` has not been spent yet."
3.  "The transaction I am authorizing is for a specific `tradeDataHash`."

This combination of cryptographic primitives allows us to build a system that is private, secure, and non-custodial.
