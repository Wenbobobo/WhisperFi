# Sepolia Testnet Deployment Guide

## Overview

This guide covers deploying WhisperFi to Sepolia testnet for full E2E testing, including withdrawal functionality that cannot be fully tested on Hardhat local network due to a Hardhat EVM bug.

## Prerequisites

### 1. Sepolia ETH

Get test ETH from faucets:
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

You'll need ~0.5 SepoliaETH for:
- Contract deployments (~0.1 ETH)
- Test deposits (0.1 ETH each)
- Gas for transactions (~0.05 ETH)

### 2. RPC Endpoint

Get a free RPC endpoint from:
- **Alchemy**: https://www.alchemy.com/ (Recommended)
- **Infura**: https://infura.io/
- **QuickNode**: https://www.quicknode.com/

## Setup

### 1. Environment Configuration

```bash
# Copy template
cp .env.template .env
```

Edit `.env`:

```bash
# Sepolia RPC URL (from Alchemy/Infura)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Your wallet private key (with Sepolia ETH)
PRIVATE_KEY=your_private_key_here

# Optional: Etherscan API key for verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

⚠️ **Security**: Never commit `.env` file or expose private keys

### 2. Verify Network Configuration

```bash
# Check Hardhat network config
npx hardhat config

# Test connection
npx hardhat run scripts/check-env.ts --network sepolia
```

## Deployment Steps

### Step 1: Deploy All Contracts

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

Expected output:
```
Deploying contracts with the account: 0x...
✅ PoseidonHasher deployed to: 0x...
✅ PoseidonHasher5 deployed to: 0x...
Verifier deployed to: 0x...
Executor deployed to: 0x...
EntryPoint deployed to: 0x...
SmartAccountFactory deployed to: 0x...
Paymaster deployed to: 0x...
✅ PrivacyPool deployed to: 0x...
🎉 All contracts deployed successfully!
```

This updates `frontend/src/config/contracts.ts` with deployed addresses.

### Step 2: Verify Contracts on Etherscan

```bash
# Verify PrivacyPool (example)
npx hardhat verify --network sepolia PRIVACY_POOL_ADDRESS "VERIFIER_ADDRESS" "POSEIDON_HASHER_ADDRESS" "POSEIDON_HASHER5_ADDRESS" "YOUR_ADDRESS"
```

Repeat for other contracts as needed.

### Step 3: Seed Test Data

```bash
npx hardhat run scripts/seed-playwright-withdraw.ts --network sepolia
```

This creates a test deposit with known credentials for E2E testing.

### Step 4: Verify Deployment

```bash
# Check contract exists
npx hardhat run scripts/check-contract-exists.ts --network sepolia

# Check merkle tree state
npx hardhat run scripts/debug-root-history.ts --network sepolia
```

## Frontend Configuration

### Update Environment

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

### Start Development Server

```bash
cd frontend
npm run dev
```

Visit http://localhost:3000 and connect wallet to Sepolia.

## Testing

### Manual Testing

1. **Deposit**:
   - Go to http://localhost:3000
   - Connect wallet (Sepolia network)
   - Make a 0.1 ETH deposit
   - Save the generated note

2. **Withdraw**:
   - Go to withdraw page
   - Enter your note
   - Enter recipient address
   - Generate proof (~30-60 seconds)
   - Submit withdrawal

### E2E Testing with Playwright

```bash
cd frontend

# Run all E2E tests on Sepolia
NEXT_PUBLIC_CHAIN_ID=11155111 npm run test:e2e

# Run specific test
NEXT_PUBLIC_CHAIN_ID=11155111 npx playwright test tests/simple-zk-test.playwright.ts
```

### Direct Withdrawal Test

```bash
# Test withdrawal with script
npx hardhat run scripts/test-withdrawal-direct.ts --network sepolia
```

Expected output:
```
🧪 Direct Withdrawal Test (No UI)
======================================================================
✅ Proof generated!
📤 Submitting Withdrawal...
✅ Confirmed in block 12345678
⛽ Gas used: 450000
🎉 SUCCESS! Withdrawal completed successfully!
```

## Gas Optimization

### Estimated Gas Costs

| Operation | Gas | Cost (@ 30 gwei) |
|-----------|-----|------------------|
| Deploy All | ~5M | ~0.15 ETH |
| Deposit | ~200K | ~0.006 ETH |
| Withdraw | ~450K | ~0.0135 ETH |
| Trade | ~600K | ~0.018 ETH |

### Tips

- Deploy during off-peak hours for lower gas
- Use `gasPrice` parameter to set custom gas price
- Monitor gas prices: https://etherscan.io/gastracker

## Troubleshooting

### Transaction Reverted

**Error**: "Invalid Merkle root"
- **Cause**: Using old/wrong merkleRoot
- **Fix**: Use latest root from contract

**Error**: "Nullifier has been used"
- **Cause**: Trying to withdraw same note twice
- **Fix**: Use a fresh deposit note

### Proof Generation Fails

**Error**: "Out of memory"
- **Cause**: ZK proof generation is memory-intensive
- **Fix**: Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`

### Network Issues

**Error**: "Network request failed"
- **Cause**: RPC endpoint down/rate-limited
- **Fix**: Try different RPC provider or wait

## Monitoring

### Check Contract State

```bash
# Get current merkle root
npx hardhat run scripts/check-contract-exists.ts --network sepolia

# List all deposits
npx hardhat run scripts/list-deposits.ts --network sepolia
```

### View on Etherscan

- Contracts: https://sepolia.etherscan.io/address/PRIVACY_POOL_ADDRESS
- Transactions: https://sepolia.etherscan.io/tx/TRANSACTION_HASH

## Cleanup

### Reset Test Environment

```bash
# Redeploy fresh contracts
npx hardhat run scripts/deploy.ts --network sepolia

# Reseed test data
npx hardhat run scripts/seed-playwright-withdraw.ts --network sepolia
```

## Security Notes

⚠️ **Testnet Only**: These contracts are for testing purposes only
- Do not use on mainnet without thorough audit
- Test keys contain NO real value
- Sepolia ETH has no monetary value

## Next Steps

After successful Sepolia deployment:
1. ✅ Run full E2E test suite
2. ✅ Test all user flows (deposit, withdraw, trade)
3. ✅ Verify gas costs and optimize
4. ✅ Test edge cases and error handling
5. 📋 Document findings for mainnet deployment

## Support

For issues:
- Check `WORKAROUND.md` for known issues
- Review `HARDHAT_BUG_REPORT.md` for Hardhat limitations
- Open GitHub issue with error details
