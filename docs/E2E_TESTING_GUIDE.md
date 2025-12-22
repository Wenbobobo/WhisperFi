# WhisperFi E2E Testing Guide

> **Complete guide for running end-to-end tests with real blockchain interactions**

## Table of Contents

1. [Overview](#overview)
2. [Test Types](#test-types)
3. [Quick Start](#quick-start)
4. [Real ZK Proof Testing](#real-zk-proof-testing)
5. [Visual Testing with Playwright UI](#visual-testing-with-playwright-ui)
6. [Debugging Tests](#debugging-tests)
7. [Troubleshooting](#troubleshooting)

---

## Overview

WhisperFi has **3 layers** of E2E testing:

| Layer | Technology | Real Blockchain | Real ZK Proof | Speed | Use Case |
|-------|-----------|-----------------|---------------|-------|----------|
| **Unit Tests** | Vitest | ❌ | ❌ | Fast (5s) | Component logic |
| **Mock E2E** | Playwright + Mock | ✅ | ❌ | Medium (30s) | UI flows |
| **Real E2E** | Playwright + Real ZK | ✅ | ✅ | Slow (90s) | Full validation |

---

## Test Types

### 1. Mock E2E Tests (Current Default)

**Location**: `frontend/tests/*.playwright.ts`

**What they do**:
- ✅ Start real Hardhat network
- ✅ Deploy real contracts
- ✅ Execute real transactions
- ❌ Mock ZK proof generation (for speed)

**When to use**:
- Rapid UI iteration
- Fee calculation testing
- Transaction flow validation

**Run command**:
```powershell
cd frontend
npx playwright test withdraw.fee-flow.playwright.ts
```

### 2. Real ZK Proof E2E Tests (Full Validation)

**Location**: `frontend/tests/full-flow.real-zk.playwright.ts`

**What they do**:
- ✅ Start real Hardhat network
- ✅ Deploy real contracts (with real Groth16 verifier)
- ✅ Generate real ZK proofs (30-60s)
- ✅ Verify proofs on-chain
- ✅ Execute complete deposit → withdraw flow

**When to use**:
- Pre-deployment validation
- Testnet readiness check
- Security audit preparation
- Debugging proof generation issues

**Run command**:
```powershell
cd frontend
npx playwright test full-flow.real-zk.playwright.ts
```

---

## Quick Start

### Prerequisites

1. **Install dependencies**:
   ```powershell
   npm install
   cd frontend && npm install
   ```

2. **Compile circuits** (for real ZK tests):
   ```powershell
   npm run compile-circuits
   npm run zkey:withdraw
   npm run verify:zk
   ```

3. **Check Playwright browsers**:
   ```powershell
   cd frontend
   npx playwright install chromium
   ```

### Running All E2E Tests

```powershell
# All tests (mock ZK)
cd frontend
npx playwright test

# Specific test file
npx playwright test withdraw.fee-flow.playwright.ts

# With UI (visual debugging)
npx playwright test --ui

# Headed mode (see browser)
npx playwright test --headed

# Debug mode (step-through)
npx playwright test --debug
```

---

## Real ZK Proof Testing

### Full Flow Test (Recommended)

This test performs the **complete workflow** from deposit to withdrawal with real ZK proofs:

```powershell
cd frontend
npx playwright test full-flow.real-zk.playwright.ts --headed
```

**What happens**:

1. **Network Setup** (5s):
   ```
   📡 Starting Hardhat local network...
   ✅ Hardhat RPC ready after 2500ms
   ```

2. **Contract Deployment** (10s):
   ```
   📦 Deploying contracts with REAL verifier...
   ✅ Script completed
   ```

3. **Deposit** (3s):
   ```
   💰 Seeding test deposit...
   ✅ Commitment: 0x1234...
   ✅ Merkle Root: 0x5678...
   ```

4. **UI Interaction** (5s):
   ```
   📝 Step 1: Filling withdrawal form...
   ✅ Form filled
   ```

5. **ZK Proof Generation** (30-60s):
   ```
   🔐 Step 2: Generating REAL ZK Proof...
   ⚠️  This will take 30-60 seconds (real circuit computation)
   ✅ Proof generated in 45.2s
   ```

6. **Withdrawal Transaction** (3s):
   ```
   💸 Step 3: Submitting withdrawal...
   📡 Broadcasting transaction...
   🔗 Tx Hash: 0xabcd...
   ✅ Confirmed in block 5
   ```

7. **Verification** (1s):
   ```
   ✅ Step 4: Verifying results...
   ✅ Recipient: +0.09 ETH
   ✅ Relayer: +0.01 ETH
   ```

**Total time**: ~60-90 seconds

### Double-Spend Prevention Test

Verifies that the same note cannot be used twice:

```powershell
cd frontend
npx playwright test full-flow.real-zk.playwright.ts -g "double-spend"
```

**Expected output**:
```
✅ First withdrawal succeeded
❌ Second withdrawal correctly rejected (nullifier already used)
🎉 Double-Spend Prevention Test Passed!
```

---

## Visual Testing with Playwright UI

### Interactive Test Explorer

Launch Playwright UI to **watch tests run** in real-time:

```powershell
cd frontend
npx playwright test --ui
```

**Features**:
- 👀 Watch browser actions in real-time
- ⏸️ Pause/resume test execution
- 📸 View screenshots at each step
- 🔍 Inspect DOM at any point
- 📊 See network requests
- 🐛 Debug failing tests

### Headed Mode (See Browser)

Run tests with visible browser window:

```powershell
cd frontend
npx playwright test --headed full-flow.real-zk.playwright.ts
```

**When to use**:
- Visual debugging
- Demo to stakeholders
- Screen recording for documentation
- Understanding UI interactions

### Recording Mode (Generate Tests)

Record new test scenarios:

```powershell
cd frontend
npx playwright codegen http://localhost:3000/e2e/withdraw
```

**Steps**:
1. Browser opens with recording toolbar
2. Interact with UI (click, type, navigate)
3. Playwright generates test code
4. Copy generated code to test file

---

## Debugging Tests

### Console Logs

E2E tests include detailed console output:

```javascript
page.on("console", (msg) => {
  console.log(`Browser: ${msg.text()}`);
});
```

**View logs**:
```powershell
npx playwright test --headed full-flow.real-zk.playwright.ts
# Watch terminal for "Browser: ..." messages
```

### Slow Motion

Slow down test execution to see actions:

```powershell
# In test file:
const context = await browser.newContext({ slowMo: 1000 }); // 1s delay per action
```

Or via command line:
```powershell
npx playwright test --headed --slowMo=500
```

### Screenshots on Failure

Automatically capture screenshots when tests fail:

```javascript
// In playwright.config.ts
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

**View artifacts**:
```powershell
cd frontend/test-results/<test-name>/
# Screenshots: *.png
# Videos: *.webm
```

### Step-by-Step Debugging

Use Playwright Inspector:

```powershell
npx playwright test --debug full-flow.real-zk.playwright.ts
```

**Features**:
- Pause before each action
- Step through test line-by-line
- Explore page state
- Try commands in console
- Resume or step over

---

## Troubleshooting

### Common Issues

#### 1. "Hardhat node exited prematurely"

**Cause**: Port 8545 already in use

**Fix**:
```powershell
# Find process on port 8545
netstat -ano | findstr :8545

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in test file
```

#### 2. "Timed out waiting for Hardhat RPC"

**Cause**: Hardhat taking too long to start

**Fix**:
- Increase timeout in `waitForRpcReady()` function
- Check if antivirus is blocking Node.js
- Ensure no firewall blocking localhost

#### 3. "Proof generation timeout"

**Cause**: Real ZK proof takes 30-60s, default timeout is too short

**Fix**:
```javascript
test.setTimeout(240_000); // 4 minutes
```

Already set in `full-flow.real-zk.playwright.ts`.

#### 4. "Circuit artifacts not found"

**Cause**: ZK circuits not compiled

**Fix**:
```powershell
npm run compile-circuits
npm run zkey:withdraw
npm run verify:zk
```

#### 5. "Browser not installed"

**Cause**: Playwright browsers not downloaded

**Fix**:
```powershell
cd frontend
npx playwright install chromium
```

#### 6. Path with spaces error

**Cause**: Windows paths with spaces (e.g., `C:\Program Files\`)

**Fix**: Already fixed in code (`shell: false`). If issues persist:
```powershell
# Set environment variable
$env:NODE_OPTIONS="--max-old-space-size=4096"
```

#### 7. "Module not found: circomlibjs"

**Cause**: Missing dependency

**Fix**:
```powershell
npm install circomlibjs snarkjs
```

---

## Test Configuration

### Playwright Config

**Location**: `frontend/playwright.config.ts`

**Key settings**:
```typescript
export default defineConfig({
  testDir: './tests',
  timeout: 180_000, // 3 minutes default
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

### Test Constants

**Location**: `playwright/constants/e2e.ts`

**Contains**:
- Test wallet addresses and private keys
- Note secrets and commitments
- RPC URLs
- Network IDs

**Security**: These are TEST-ONLY values. Never use in production!

---

## Advanced Usage

### Parallel Test Execution

Run multiple tests in parallel:

```powershell
# Default: 50% of CPU cores
npx playwright test --workers=2

# Max parallelism
npx playwright test --workers=100%

# Serial mode (one at a time)
npx playwright test --workers=1
```

**Note**: Real ZK tests are already serial due to Hardhat network constraints.

### Filtering Tests

```powershell
# Run tests matching pattern
npx playwright test -g "withdrawal"

# Run specific file
npx playwright test withdraw.fee-flow.playwright.ts

# Run specific test
npx playwright test -g "submits via mocked proof"

# Exclude tests
npx playwright test --grep-invert "double-spend"
```

### Reporting

```powershell
# HTML report (auto-opens on failure)
npx playwright test --reporter=html

# JSON report (for CI)
npx playwright test --reporter=json

# Custom reporter
npx playwright test --reporter=./custom-reporter.ts
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          cd frontend && npm install

      - name: Compile circuits
        run: |
          npm run compile-circuits
          npm run zkey:withdraw

      - name: Install Playwright
        run: |
          cd frontend
          npx playwright install chromium

      - name: Run E2E tests
        run: |
          cd frontend
          npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: frontend/test-results/
```

---

## Performance Benchmarks

### Test Execution Times

| Test Suite | Tests | Time | Notes |
|------------|-------|------|-------|
| Mock E2E (fee-flow) | 4 tests | ~45s | Includes Hardhat startup |
| Real ZK (full-flow) | 2 tests | ~150s | Real proof generation |
| All Playwright | 9 specs | ~120s | Parallel execution |

### Breakdown (Real ZK Test)

| Phase | Time | % |
|-------|------|---|
| Hardhat startup | 5s | 5% |
| Contract deployment | 10s | 10% |
| Deposit transaction | 3s | 3% |
| UI interaction | 5s | 5% |
| **ZK proof generation** | **45s** | **50%** |
| Withdrawal transaction | 3s | 3% |
| Verification | 1s | 1% |
| Cleanup | 2s | 2% |

**Bottleneck**: ZK proof generation (expected, cryptographically intensive)

---

## Best Practices

### 1. Test Isolation

✅ **DO**:
- Use `test.beforeAll()` for shared setup (Hardhat, deployment)
- Use `test.afterAll()` for cleanup (stop Hardhat)
- Each test gets fresh browser context

❌ **DON'T**:
- Share browser contexts between tests
- Modify global state in tests
- Skip cleanup (causes port conflicts)

### 2. Timeouts

✅ **DO**:
```javascript
test.setTimeout(240_000); // Explicit timeout for slow tests
```

❌ **DON'T**:
```javascript
// Relying on global timeout (may be too short)
```

### 3. Assertions

✅ **DO**:
```javascript
await expect(page.getByLabel("Note")).toHaveValue(NOTE_VALUE);
```

❌ **DON'T**:
```javascript
const value = await page.getByLabel("Note").inputValue();
expect(value).toBe(NOTE_VALUE); // Breaks auto-retry
```

### 4. Waiting

✅ **DO**:
```javascript
await page.waitForFunction(() => window.__e2e__?.ready === true);
```

❌ **DON'T**:
```javascript
await delay(5000); // Brittle, slow
```

---

## Useful Commands Cheat Sheet

```powershell
# Quick test (mock ZK)
cd frontend && npx playwright test withdraw.fee-flow.playwright.ts

# Full validation (real ZK)
cd frontend && npx playwright test full-flow.real-zk.playwright.ts --headed

# Visual debugging
cd frontend && npx playwright test --ui

# Generate new test
cd frontend && npx playwright codegen http://localhost:3000

# Debug mode
cd frontend && npx playwright test --debug

# Show report
cd frontend && npx playwright show-report

# Update snapshots
cd frontend && npx playwright test --update-snapshots
```

---

## Next Steps

1. **Run your first test**:
   ```powershell
   cd frontend
   npx playwright test withdraw.fee-flow.playwright.ts --headed
   ```

2. **Try real ZK proof**:
   ```powershell
   npx playwright test full-flow.real-zk.playwright.ts --headed
   ```

3. **Explore UI mode**:
   ```powershell
   npx playwright test --ui
   ```

4. **Read official docs**: https://playwright.dev/docs/intro

---

**Last Updated**: 2025-12-20
**Version**: 1.0.0
