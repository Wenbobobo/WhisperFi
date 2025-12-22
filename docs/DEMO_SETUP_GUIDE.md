# WhisperFi Demo Configuration Guide

## 🔧 Pre-Demo Setup Instructions

### 1. Price Configuration
Edit `frontend/src/config/prices.ts` to adjust token prices for your demo:

```typescript
export const DEMO_PRICES = {
  ETH: 2650.00,    // ← Change this for your demo
  USDC: 1.00,      
  DAI: 0.999,      
  WBTC: 65500.00,  
};

export const USE_REAL_API = false; // Set true for live prices, false for demo
```

### 2. File Format Changes
- **Deposit**: Now generates `.key` files (professional format)
- **Withdraw/Trade**: Accepts both `.key` and `.txt` files
- All references changed from "note" to "private key"

### 3. Trade Transaction Verification

After confirming a trade transaction, you can verify it by:

1. **Check Node Terminal**: Look for transaction logs
2. **MetaMask Activity**: View transaction in wallet history  
3. **Local Explorer**: Access via `http://localhost:8545` (if available)
4. **Trade History**: Click "Trade History" button in app header

### 4. Transaction Hash Format
- **Real transactions**: Blue links in trade history with "Real TX" badge
- **Mock transactions**: Regular display for demo fallback

## 🚀 Quick Demo Setup

1. **Adjust prices** in `prices.ts` if needed
2. **Start Hardhat node**: `npx hardhat node`
3. **Deploy contracts**: `npx hardhat run scripts/deploy-swap-demo.js --network localhost`
4. **Start frontend**: `npm run dev`
5. **Connect MetaMask** to localhost:8545

## 📋 Demo Flow
1. **Deposit**: Creates `.key` file with private key
2. **Withdraw**: Upload `.key` file + enter recipient address → wallet interaction
3. **Trade**: Upload `.key` file → select DEX/tokens → real swap transaction
4. **History**: View all transactions with real/mock indicators

---
*All prices and transactions are configurable for seamless demo presentations!*
