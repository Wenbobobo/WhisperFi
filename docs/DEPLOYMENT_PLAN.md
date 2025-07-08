# Deployment Plan

## 1. Pre-deployment

- Compile the smart contracts.
- Run all tests.
- Generate the ZK verifier contract.

## 2. Deployment

- Deploy the `Verifier.sol` contract.
- Deploy the `Executor.sol` contract.
- Deploy the `PrivacyPool.sol` contract, passing the addresses of the `Verifier.sol` and `Executor.sol` contracts to the constructor.

## 3. Post-deployment

- Verify the smart contracts on Etherscan.
- Transfer ownership of the `Executor.sol` contract to the `PrivacyPool.sol` contract.
- Announce the deployment to the community.
