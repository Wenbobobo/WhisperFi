# Testing Plan

## 1. Unit Tests

### 1.1. `PrivacyPool.sol`

- **`deposit()`**
  - It should correctly add a new commitment to the Merkle tree.
  - It should correctly update the Merkle root.
  - It should emit a `Deposit` event with the correct parameters.
  - It should revert if the Merkle tree is full.
- **`withdraw()`**
  - It should correctly verify a valid proof.
  - It should correctly transfer the funds to the recipient.
  - It should correctly mark the nullifier as used.
  - It should emit a `Withdrawal` event with the correct parameters.
  - It should revert if the nullifier has already been used.
  - It should revert if the proof is invalid.
- **`trade()`**
  - It should correctly verify a valid proof.
  - It should correctly mark the nullifier as used.
  - It should correctly add the new commitment to the Merkle tree.
  - It should emit a `Trade` event with the correct parameters.
  - It should revert if the nullifier has already been used.
  - It should revert if the proof is invalid.

### 1.2. `Executor.sol`

- **`execute()`**
  - It should correctly execute a call to an external contract.
  - It should only be callable by the owner.
  - It should revert if the external call fails.

## 2. Integration Tests

- The `PrivacyPool.sol` and `Executor.sol` contracts should work together correctly.
- The `trade` function in `PrivacyPool.sol` should correctly call the `execute` function in `Executor.sol`.

## 3. End-to-End Tests

- A user should be able to deposit funds, execute a trade, and withdraw the remaining funds.
- The entire process should be private and secure.
