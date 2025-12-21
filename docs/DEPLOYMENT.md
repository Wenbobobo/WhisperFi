# WhisperFi Deployment Guide

> **⚠️ SECURITY WARNING**: This guide contains sensitive deployment procedures. Always use testnet first before mainnet deployment.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Local Deployment](#local-deployment)
4. [Testnet Deployment (Sepolia)](#testnet-deployment-sepolia)
5. [Mainnet Deployment](#mainnet-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedures](#rollback-procedures)
8. [Security Best Practices](#security-best-practices)

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`npx hardhat test`)
- [ ] Frontend tests passing (`cd frontend && npm run test`)
- [ ] E2E tests passing (`npx playwright test`)
- [ ] No compiler warnings (`npx hardhat compile`)
- [ ] Code coverage ≥ 80% for contracts
- [ ] Security audit completed (for mainnet)

### ZK Artifacts
- [ ] Circuits compiled (`npm run circuit:compile`)
- [ ] ZK artifacts checksums verified (`npm run verify:zk`)
- [ ] Artifacts uploaded to CDN/IPFS (for production)
- [ ] WASM/zkey files in correct paths

### Configuration
- [ ] `.env` file configured (copy from `.env.template`)
- [ ] Environment variables validated (`npx ts-node scripts/check-env.ts`)
- [ ] Network configuration in `hardhat.config.ts`
- [ ] Frontend contract addresses prepared
- [ ] No secrets in git (`git grep -i "private.*key"` returns nothing)

### Infrastructure
- [ ] RPC endpoint tested and rate limits confirmed
- [ ] Block explorer API key obtained (for verification)
- [ ] Deployment wallet funded with gas
- [ ] Backup wallet address recorded

---

## Environment Setup

### 1. Copy Environment Template

```powershell
cp .env.template .env
```

### 2. Configure Required Variables

Edit `.env` and fill in:

```bash
# Network RPC
INFURA_API_KEY=your_actual_infura_key

# Deployment wallet
DEPLOYER_PRIVATE_KEY=0x...  # NEVER share this!

# Block explorer
ETHERSCAN_API_KEY=your_actual_etherscan_key
```

### 3. Validate Configuration

```powershell
npx ts-node scripts/check-env.ts
```

Expected output:
```
✅ Environment variables loaded and validated
✅ No secrets detected in git-tracked files
✅ Environment configuration is valid!
```

---

## Local Deployment

### 1. Start Hardhat Node

```powershell
npx hardhat node
```

Keep this terminal open.

### 2. Deploy Contracts (New Terminal)

```powershell
npx hardhat run scripts/deploy.ts --network hardhat
```

### 3. Generate Address Registry

```powershell
npx ts-node scripts/generate-addresses.ts --network=hardhat
```

This creates `config/addresses.json` with deployed addresses.

### 4. Validate Deployment

```powershell
npx ts-node scripts/validate-addresses.ts --network=hardhat --strict
```

### 5. Start Frontend

```powershell
cd frontend
npm run dev
```

Visit `http://localhost:3000` to test.

---

## Testnet Deployment (Sepolia)

### 1. Fund Deployment Wallet

Minimum gas needed: **~0.5 ETH** (for all contracts + verification)

Get Sepolia ETH from faucets:
- https://sepoliafaucet.com
- https://faucet.sepolia.dev

Verify balance:
```powershell
npx hardhat run scripts/check-balance.ts --network sepolia
```

### 2. Deploy to Sepolia

```powershell
npx hardhat run scripts/deploy.ts --network sepolia
```

**Expected deployment time**: 5-10 minutes

Contracts deployed in order:
1. PoseidonT3 (library)
2. Groth16Verifier
3. PrivacyPool (links PoseidonT3)
4. EntryPoint (ERC-4337, or use existing)
5. SimpleAccountFactory
6. Paymaster

### 3. Verify Contracts on Etherscan

```powershell
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Example for PrivacyPool:
```powershell
npx hardhat verify --network sepolia 0x... 0x...verifier_address 0x...poseidon_address
```

### 4. Generate Address Registry

```powershell
npx ts-node scripts/generate-addresses.ts --network=sepolia
```

### 5. Validate Deployment

```powershell
npx ts-node scripts/validate-addresses.ts --network=sepolia --strict
```

### 6. Update Frontend Configuration

```bash
# In frontend/.env.local
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_PRIVACY_POOL_ADDRESS=0x...
NEXT_PUBLIC_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_ENTRY_POINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x...
```

### 7. Deploy Frontend to Testnet Environment

```powershell
cd frontend
npm run build
npm run start
```

Or deploy to Vercel/Netlify for public testing.

---

## Mainnet Deployment

### ⚠️ CRITICAL SECURITY CHECKS

**Before proceeding:**

1. **Security Audit Required**: Do NOT deploy without a professional audit
2. **Bug Bounty Program**: Consider setting up a bug bounty
3. **Gradual Rollout**: Start with limited deposit amounts
4. **Multi-Sig Wallet**: Use Gnosis Safe for contract ownership
5. **Insurance**: Consider DeFi insurance (Nexus Mutual, InsurAce)

### Pre-Mainnet Checklist

- [ ] Security audit report reviewed and all issues resolved
- [ ] Testnet deployment tested for ≥2 weeks
- [ ] All E2E tests pass on testnet
- [ ] Gas optimization completed
- [ ] Emergency pause mechanism tested
- [ ] Multi-sig wallet configured (3-of-5 recommended)
- [ ] Deployment transaction simulated with Tenderly
- [ ] Team ready for 24/7 monitoring for first week

### 1. Fund Deployment Wallet

Minimum gas needed: **~2 ETH** (Mainnet gas is higher)

**IMPORTANT**: Use a fresh wallet with ONLY the deployment funds. Never reuse keys.

### 2. Deploy to Mainnet

```powershell
# FINAL CONFIRMATION
echo "⚠️ DEPLOYING TO MAINNET - ARE YOU SURE? (Ctrl+C to cancel)"
timeout /t 10

npx hardhat run scripts/deploy.ts --network mainnet
```

### 3. Transfer Ownership to Multi-Sig

**CRITICAL**: Immediately after deployment, transfer ownership to Gnosis Safe:

```powershell
npx hardhat run scripts/transfer-ownership.ts --network mainnet
```

### 4. Verify Contracts

```powershell
# Verify each contract
npx ts-node scripts/verify-all-contracts.ts --network mainnet
```

### 5. Post-Deployment Smoke Tests

```powershell
npx ts-node scripts/smoke-test.ts --network mainnet
```

Tests:
- Contract code deployed correctly
- ZK verification works on-chain
- Deposit/withdraw flow (small amounts)
- Fee distribution correct
- Emergency pause functional

### 6. Configure Monitoring

- Set up Etherscan alerts for contract transactions
- Configure Tenderly for real-time alerts
- Set up Discord/Telegram webhook notifications
- Monitor contract balance continuously

---

## Post-Deployment Verification

### Manual Verification Checklist

#### Contract Verification
- [ ] All contracts verified on Etherscan
- [ ] Source code matches deployed bytecode
- [ ] Constructor arguments correct
- [ ] Read functions return expected values

#### Functional Testing
- [ ] Small test deposit succeeds
- [ ] ZK proof generates and verifies
- [ ] Test withdrawal succeeds
- [ ] Fee split correct (recipient + relayer)
- [ ] Nullifier prevents double-spend
- [ ] Gas estimates reasonable

#### Security Testing
- [ ] Ownership transferred to multi-sig
- [ ] Only EntryPoint can call protected functions
- [ ] Replay attacks prevented
- [ ] Merkle root validation works
- [ ] Emergency pause functional

#### Frontend Integration
- [ ] Contract addresses loaded correctly
- [ ] Wallet connection works
- [ ] Transaction submission succeeds
- [ ] Error messages user-friendly
- [ ] ZK artifacts load from CDN

---

## Rollback Procedures

### If Deployment Fails

1. **Do NOT panic** - funds are safe if deployment reverted
2. Check error message in transaction receipt
3. Verify environment variables: `npx ts-node scripts/check-env.ts`
4. Check gas price and network congestion
5. Re-run deployment with increased gas limit

### If Bug Discovered Post-Deployment

#### Severity: Critical (Funds at Risk)

1. **IMMEDIATELY** activate emergency pause (if implemented)
2. Announce issue on Discord/Twitter
3. Coordinate with security team
4. Prepare upgrade/migration strategy
5. **DO NOT** rush - test fix thoroughly on testnet first

#### Severity: High (Functional Issue)

1. Disable affected features if possible
2. Deploy fixed contracts to new addresses
3. Update frontend to use new addresses
4. Migrate users gradually

#### Severity: Low (UI Issue)

1. Fix in frontend only
2. Redeploy frontend
3. No contract changes needed

---

## Security Best Practices

### Key Management

- **NEVER** commit private keys to git
- Use hardware wallets (Ledger, Trezor) for mainnet
- Store backup seeds in physical safe or bank vault
- Use different keys for testnet and mainnet
- Rotate keys regularly (every 6 months)

### Access Control

- Use multi-sig wallets (Gnosis Safe) for contract ownership
- Require 3-of-5 signatures for critical operations
- Time-lock critical parameter changes (24-48 hours)
- Separate roles: deployer, owner, operator, pauser

### Monitoring

- Set up alerts for:
  - Large withdrawals (> 1 ETH)
  - Unusual transaction patterns
  - Contract balance changes
  - Failed transactions
  - Gas price spikes

### Incident Response Plan

1. **Detection**: Automated alerts + manual monitoring
2. **Assessment**: Determine severity (Critical/High/Medium/Low)
3. **Containment**: Pause contracts if necessary
4. **Communication**: Notify users within 1 hour
5. **Resolution**: Deploy fix after thorough testing
6. **Post-Mortem**: Document incident and improve processes

---

## Useful Commands

```powershell
# Generate deployment addresses
npx ts-node scripts/generate-addresses.ts --network=<network>

# Validate addresses
npx ts-node scripts/validate-addresses.ts --network=<network> --strict

# Check environment configuration
npx ts-node scripts/check-env.ts

# Verify ZK artifacts
npm run verify:zk

# Run smoke tests
npx ts-node scripts/smoke-test.ts --network=<network>

# Check deployment wallet balance
npx hardhat run scripts/check-balance.ts --network=<network>
```

---

## Troubleshooting

### "Insufficient funds for gas"
- Check wallet balance: `npx hardhat run scripts/check-balance.ts --network sepolia`
- Get testnet ETH from faucets
- For mainnet, ensure ≥2 ETH available

### "Nonce too low"
- Reset nonce: `npx hardhat run scripts/reset-nonce.ts --network <network>`
- Or wait for pending transactions to confirm

### "Contract verification failed"
- Ensure constructor arguments match exactly
- Check Solidity version matches deployment
- Try manual verification on Etherscan

### "Frontend can't connect to contracts"
- Verify addresses in `frontend/.env.local`
- Check RPC URL is correct and accessible
- Ensure chain ID matches network

---

## Additional Resources

- [Hardhat Deployment Guide](https://hardhat.org/guides/deploying.html)
- [Etherscan Verification Guide](https://info.etherscan.com/how-to-verify-a-smart-contract/)
- [ERC-4337 Deployment Best Practices](https://docs.stackup.sh/docs/deployment-best-practices)
- [Gnosis Safe Setup](https://help.gnosis-safe.io/)
- [Tenderly Monitoring](https://docs.tenderly.co/monitoring-and-alerting/intro-to-alerting)

---

## Support

If you encounter issues during deployment:

1. Check existing issues: https://github.com/whisperfi/whisperfi/issues
2. Ask in Discord: https://discord.gg/whisperfi
3. Emergency contact: security@whisperfi.io

---

**Last Updated**: 2025-12-20
**Version**: 1.0.0
