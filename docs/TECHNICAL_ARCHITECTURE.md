# Technical Architecture: Phantom Protocol

**Version:** 1.0
**Date:** 2025-07-07

**Status:** DRAFT

## 1. Guiding Principles

This architecture is derived from the strategic decision to prioritize **Plan A: A sophisticated, MEV-aware Relayer network executing trades from a managed pool of addresses.** The primary goals of this architecture are:

- **Maximum MEV-Resistance:** Protect user transactions from front-running, sandwich attacks, and other forms of MEV.
- **Transactional Anonymity:** Obfuscate the link between a user's deposit address and their on-chain DeFi actions.
- **Gas Efficiency:** Minimize the cost for the end-user.
- **Non-Custodial Security:** At no point should the protocol or the relayer have the ability to seize user funds.

## 2. System Components

The system is composed of three main components:

1.  **On-Chain Contracts (Solidity):** The immutable logic that governs the protocol.
2.  **ZK Circuits (Circom):** The cryptographic heart of the protocol, enabling private state transitions.
3.  **Off-Chain Relayer (Node.js/Go):** The centralized but trusted execution agent.

### 2.1. On-Chain Contracts

#### `PrivacyPool.sol`
- **Purpose:** The main user-facing contract. Handles deposits, withdrawals, and manages the state of private commitments.
- **State Variables:**
    - `merkleTree`: A Merkle tree of all deposit commitments.
    - `nullifiers`: A mapping to store spent nullifiers to prevent double-spending.
    - `verifier`: The address of the ZK proof verifier contract.
- **Core Functions:**
    - `deposit(bytes32 commitment)`: Adds a new commitment to the Merkle tree.
    - `trade(bytes zkProof, bytes32[] publicInputs)`: The core function. Verifies the ZK proof, checks the nullifier, and then calls the `Executor` contract to perform the trade.
    - `withdraw(...)`: Allows users to privately withdraw their funds.

#### `Executor.sol`
- **Purpose:** A protocol-owned contract responsible for executing the actual DeFi interactions. This contract holds a pool of funds for gas and can be one of many executor addresses to increase the anonymity set.
- **Core Functions:**
    - `execute(address target, bytes memory callData)`: A generic execution function that can call any other contract. This function will be called by `PrivacyPool.sol` after a `trade` proof is successfully verified.

#### `Verifier.sol`
- **Purpose:** An auto-generated contract from `snarkjs` that contains the logic to verify the ZK proofs for the `trade` and `withdraw` circuits.

### 2.2. ZK Circuits

#### `deposit.circom`
- **Purpose:** To be run client-side to generate a commitment hash from the user's deposit details (amount, secret, etc.).

#### `trade.circom`
- **Purpose:** The most complex circuit. Proves that a user owns a valid, unspent note in the Merkle tree and authorizes a specific external transaction.
- **Private Inputs:**
    - `oldNote`: The user's private note to be spent.
    - `merklePath`: The path to prove the note's inclusion in the Merkle tree.
- **Public Inputs:**
    - `merkleRoot`: The current root of the Merkle tree.
    - `nullifier`: The hash of the old note's secret, to prevent double-spending.
    - `newNoteCommitment`: The commitment of the change note.
    - `tradeDataHash`: A hash of the execution details (target contract, callData, etc.). This links the proof to a specific action.

### 2.3. Off-Chain Relayer

- **Purpose:** The brain of the operation. Provides a seamless experience for the user and protects them from MEV.
- **Responsibilities:**
    - **API Endpoint:** Provides an endpoint for users to submit their ZK proofs and desired transactions.
    - **Gas Abstraction:** Pays the gas fees for the user's transaction, deducting the cost from the user's private balance (or charging a separate fee).
    - **MEV Protection:** Does **not** broadcast the transaction to the public mempool. Instead, it sends the transaction directly to a trusted block builder via a private channel (e.g., Flashbots API).
    - **Transaction Execution:** Calls the `trade` function on the `PrivacyPool.sol` contract.

## 3. Core User Flow: A Private Swap

1.  **Deposit:** User deposits 10 ETH into `PrivacyPool.sol`. A commitment is added to the Merkle tree.
2.  **Trade Intent:** User decides to swap 5 ETH for USDC on Uniswap. They construct the transaction details off-chain.
3.  **Proof Generation:** The user's browser generates a ZK proof using the `trade.circom` circuit. The proof authorizes the spending of the 10 ETH note and the creation of a ~5 ETH change note, and links to the hash of the Uniswap trade data.
4.  **Submission to Relayer:** The user sends the generated proof and the un-hashed trade data to the Relayer's private API endpoint.
5.  **Relayer Action:**
    - The Relayer verifies that the `tradeDataHash` in the proof matches the trade data it received.
    - The Relayer constructs a transaction to call `PrivacyPool.trade()` with the proof and public inputs.
    - The Relayer sends this transaction directly to a block builder (e.g., `relay.flashbots.net`).
6.  **On-Chain Execution:**
    - The builder includes the transaction in a block.
    - `PrivacyPool.trade()` is executed.
    - The `Verifier` contract confirms the ZK proof is valid.
    - The `PrivacyPool` contract calls `Executor.execute()` with the Uniswap trade data.
    - `Executor.sol` calls Uniswap's `swap()` function.
7.  **Result:** The swap is executed. On-chain observers only see an address belonging to the Phantom Protocol's `Executor` pool calling Uniswap. The link to the user's initial 10 ETH deposit is broken.
