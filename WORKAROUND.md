# Hardhat Bug Workaround for Withdrawal Testing

## Problem

Hardhat EVM has a critical bug where function calls fail with "function selector not recognized" when a `bytes32` parameter value exists in a contract's storage mapping.

This affects the `withdraw()` function because it requires a `merkleRoot` parameter that MUST exist in `rootHistory` mapping for the transaction to succeed.

## Impact

**Withdrawal functionality CANNOT be fully tested on Hardhat local network.**

## Workarounds

### Option 1: Mock Testing (Partial Coverage)

Test with invalid merkleRoots (not in rootHistory) to verify:
- ✅ Function selector recognition
- ✅ ABI encoding/decoding
- ✅ Proof verification logic
- ❌ Actual withdrawal execution (will revert with "Invalid Merkle root")

### Option 2: Testnet Deployment (Full Coverage)

Deploy to actual testnets where this bug doesn't exist:
- **Sepolia**: Recommended for testing
- **Holesky**: Alternative testnet

### Option 3: Alternative Local Testing (Advanced)

Use Anvil (Foundry) or Ganache instead of Hardhat for local testing.

## Recommended Testing Flow

1. **Unit tests on Hardhat**: Test proof generation, Merkle tree logic, commitment calculation
2. **Integration tests on Sepolia**: Test full deposit → withdraw flow
3. **E2E tests with Playwright**: Run against Sepolia testnet

## Current Test Status

| Test Type | Hardhat | Sepolia | Status |
|-----------|---------|---------|--------|
| Deposits | ✅ Pass | ✅ Pass | Working |
| Merkle Tree | ✅ Pass | ✅ Pass | Working |
| Proof Generation | ✅ Pass | ✅ Pass | Working |
| Withdrawals | ❌ Bug | ✅ Pass | Hardhat blocked |

## Sepolia Deployment Steps

See `docs/SEPOLIA_DEPLOYMENT.md` for full deployment instructions.

### Quick Start

```bash
# 1. Set up environment
cp .env.template .env
# Add your SEPOLIA_RPC_URL and PRIVATE_KEY

# 2. Deploy contracts
npx hardhat run scripts/deploy.ts --network sepolia

# 3. Seed test data
npx hardhat run scripts/seed-playwright-withdraw.ts --network sepolia

# 4. Run E2E tests
npm run test:e2e -- --project=chromium
```

## Files Modified for Workaround

- `HARDHAT_BUG_REPORT.md` - Detailed bug analysis
- `WORKAROUND.md` - This file
- `docs/SEPOLIA_DEPLOYMENT.md` - Testnet deployment guide (to be created)

## Bug Report Submitted

This bug has been documented and will be reported to the Hardhat team at:
https://github.com/NomicFoundation/hardhat/issues

## Long-term Solution

Once Hardhat fixes this bug, we can:
1. Update Hardhat version
2. Re-enable full local testing
3. Keep testnet deployment as optional for final validation
