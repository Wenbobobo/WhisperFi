# WhisperFi Testing Quick Reference

> **快速命令参考卡片** - 所有测试命令一览

## 📋 目录

1. [Contract Tests](#contract-tests) - Hardhat 合约测试
2. [Frontend Tests](#frontend-tests) - Vitest 组件测试
3. [E2E Tests](#e2e-tests) - Playwright 端到端测试
4. [Real ZK Tests](#real-zk-tests) - 真实 ZK 证明测试
5. [Visual Testing](#visual-testing) - 可视化测试
6. [Coverage Reports](#coverage-reports) - 覆盖率报告
7. [Quick Commands](#quick-commands) - 常用命令速查

---

## Contract Tests

### 基础测试

```powershell
# 运行所有合约测试
npx hardhat test

# 运行特定测试文件
npx hardhat test test/unit/PrivacyPool.test.ts

# 运行带gas报告的测试
REPORT_GAS=true npx hardhat test

# 测试覆盖率
npx hardhat coverage
```

### 特定测试套件

```powershell
# 只测试 PrivacyPool
npx hardhat test test/unit/PrivacyPool.test.ts

# 只测试 Paymaster
npx hardhat test test/unit/Paymaster.test.ts

# 只测试集成测试
npx hardhat test test/integration/
```

### 当前状态

- **总测试数**: 103 passing
- **覆盖率**: ~80% (已达标 ✅)
- **运行时间**: ~30秒

---

## Frontend Tests

### Vitest 组件测试

```powershell
cd frontend

# 运行所有测试（带覆盖率）
npm run test

# 监视模式（开发时使用）
npm run test:watch

# 只运行特定测试
npx vitest run ProofProgressBar.test.tsx

# UI模式（可视化）
npx vitest --ui
```

### 当前状态

- **总测试数**: 126 passing
- **覆盖率**: ~55% (目标: ≥60% ⚠️)
- **运行时间**: ~10秒

---

## E2E Tests

### Playwright 端到端测试（Mock ZK）

```powershell
cd frontend

# 运行所有E2E测试
npm run e2e

# UI模式（推荐，可视化交互式）
npm run e2e:ui

# Headed模式（显示浏览器）
npm run e2e:headed

# 调试模式（逐步执行）
npm run e2e:debug

# 查看测试报告
npm run e2e:report
```

### 特定测试文件

```powershell
cd frontend

# 费用流测试
npx playwright test withdraw.fee-flow.playwright.ts

# 正向流程测试
npx playwright test withdraw.positive-flow.playwright.ts

# 缓存同步测试
npx playwright test withdraw.cache-sync.playwright.ts

# 多Tab测试
npx playwright test withdraw.multi-tab.playwright.ts
```

### 当前状态

- **总测试数**: 9 specs
- **运行时间**: ~45秒（并行）
- **特点**: 使用 mock ZK proof（快速）

---

## Real ZK Tests

### 真实 ZK 证明测试（完整验证）

```powershell
cd frontend

# 运行真实ZK测试（完整流程）
npm run e2e:real-zk

# 或使用便捷脚本（Windows）
..\scripts\run-e2e-visual.ps1 -Mode real-zk

# 或使用bash脚本（Linux/Mac）
../scripts/run-e2e-visual.sh real-zk
```

### 测试内容

✅ **完整流程验证**:
1. 启动本地 Hardhat 网络
2. 部署真实合约（含真实 Groth16 verifier）
3. 执行存款交易
4. 生成**真实** ZK 证明（30-60秒）
5. 链上验证证明
6. 执行提款交易
7. 验证资金分配

✅ **双花攻击防护测试**:
- 第一次提款成功
- 第二次提款被拒绝（nullifier already used）

### 当前状态

- **总测试数**: 2 tests
- **运行时间**: ~90秒（ZK证明生成耗时）
- **特点**: 完整的端到端验证，真实密码学计算

---

## Visual Testing

### 便捷脚本使用

#### Windows PowerShell

```powershell
# UI模式（交互式测试浏览器）
.\scripts\run-e2e-visual.ps1

# 或指定模式
.\scripts\run-e2e-visual.ps1 -Mode ui
.\scripts\run-e2e-visual.ps1 -Mode headed
.\scripts\run-e2e-visual.ps1 -Mode real-zk
.\scripts\run-e2e-visual.ps1 -Mode quick
.\scripts\run-e2e-visual.ps1 -Mode debug
```

#### Linux/Mac Bash

```bash
# UI模式
./scripts/run-e2e-visual.sh

# 或指定模式
./scripts/run-e2e-visual.sh ui
./scripts/run-e2e-visual.sh headed
./scripts/run-e2e-visual.sh real-zk
./scripts/run-e2e-visual.sh quick
./scripts/run-e2e-visual.sh debug
```

### 模式说明

| 模式 | 说明 | 用途 |
|------|------|------|
| `ui` | 交互式测试浏览器 | 推荐：可视化调试、实时查看 |
| `headed` | 显示浏览器窗口 | 演示、录制、观察交互 |
| `real-zk` | 真实ZK证明测试 | 完整验证、上线前检查 |
| `quick` | 快速mock测试 | 快速迭代、CI/CD |
| `debug` | 逐步调试模式 | 问题排查、深度调试 |

---

## Coverage Reports

### 合约覆盖率

```powershell
# 生成覆盖率报告
npx hardhat coverage

# 查看报告
start coverage/index.html
```

**当前覆盖率**: ~80% ✅

### 前端覆盖率

```powershell
cd frontend

# 生成覆盖率报告
npm run test

# 查看报告
start coverage/index.html
```

**当前覆盖率**: ~55% (目标: ≥60% ⚠️)

### 覆盖率目标

| 模块 | 当前 | 目标 | 状态 |
|------|------|------|------|
| 合约 | ~80% | ≥80% | ✅ 已达标 |
| 前端 | ~55% | ≥60% | ⚠️ 需提升 |
| E2E | 9 specs | 15 specs | ⚠️ 需增加 |

---

## Quick Commands

### 🚀 快速开始

```powershell
# 1. 运行所有测试（快速验证）
npx hardhat test                    # 合约测试
cd frontend && npm run test         # 前端测试
npm run e2e                         # E2E测试

# 2. 可视化测试（推荐）
cd frontend && npm run e2e:ui       # 交互式测试浏览器

# 3. 真实ZK测试（上线前）
cd frontend && npm run e2e:real-zk  # 完整验证
```

### 📊 覆盖率检查

```powershell
# 合约覆盖率
npx hardhat coverage

# 前端覆盖率
cd frontend && npm run test

# 查看报告
start coverage/index.html
```

### 🐛 调试测试

```powershell
# 逐步调试E2E测试
cd frontend && npm run e2e:debug

# 监视模式（自动重跑）
cd frontend && npm run test:watch

# 详细输出
npx hardhat test --verbose
```

### 🎯 特定场景

```powershell
# 只测试ZK验证
npx hardhat test test/unit/PrivacyPool.test.ts -g "verify proof"

# 只测试费用分配
cd frontend && npx playwright test withdraw.fee-flow.playwright.ts

# 只测试缓存逻辑
cd frontend && npx vitest run localCache.test.ts
```

---

## 测试文件清单

### 合约测试 (test/)

```
test/
├── unit/
│   ├── PrivacyPool.test.ts          (45 tests)
│   ├── Paymaster.test.ts             (23 tests)
│   ├── Paymaster.security.test.ts    (23 tests)
│   └── SimpleAccount.test.ts         (12 tests)
└── integration/
    ├── withdraw-negative.test.ts     (20 tests)
    └── withdraw-payment-chain.test.ts (12 tests)
```

**Total**: 103 passing

### 前端测试 (frontend/src/)

```
frontend/src/
├── components/
│   ├── ProofProgressBar.test.tsx     (11 tests)
│   └── WithdrawCard.test.tsx         (10 tests)
├── lib/
│   ├── errors/errorMap.test.ts       (70 tests)
│   ├── withdraw/localCache.test.ts   (15 tests)
│   └── withdraw/cacheSync.test.ts    (10 tests)
└── hooks/
    └── useWithdraw.test.ts           (10 tests)
```

**Total**: 126 passing

### E2E测试 (frontend/tests/)

```
frontend/tests/
├── withdraw.positive-flow.playwright.ts    (3 tests)
├── withdraw.fee-flow.playwright.ts         (4 tests)
├── withdraw.cache-sync.playwright.ts       (1 test)
├── withdraw.multi-tab.playwright.ts        (1 test)
└── full-flow.real-zk.playwright.ts         (2 tests) ⭐ NEW
```

**Total**: 9 specs (11 tests)

---

## 常见问题速查

### Q: 测试运行很慢？

**A**: 使用并行模式
```powershell
# 合约测试（并行）
npx hardhat test --parallel

# E2E测试（并行）
cd frontend && npx playwright test --workers=2
```

### Q: 如何只运行失败的测试？

**A**: 使用Playwright的last-failed模式
```powershell
cd frontend && npx playwright test --last-failed
```

### Q: 如何查看测试输出？

**A**: 使用verbose或headed模式
```powershell
# 详细输出
npx hardhat test --verbose

# 可视化浏览器
cd frontend && npm run e2e:headed
```

### Q: 真实ZK测试太慢？

**A**: 正常情况，ZK证明生成需要30-60秒
```powershell
# 日常开发使用mock测试
npm run e2e

# 上线前使用真实测试
npm run e2e:real-zk
```

### Q: 如何录制测试？

**A**: 使用Playwright codegen
```powershell
cd frontend && npx playwright codegen http://localhost:3000
```

---

## 测试策略建议

### 日常开发

```powershell
# 1. 修改代码后
cd frontend && npm run test:watch    # 自动重跑相关测试

# 2. 提交前
npx hardhat test                     # 合约测试
cd frontend && npm run test          # 前端测试
npm run e2e                          # 快速E2E测试
```

### PR提交前

```powershell
# 完整测试套件
npx hardhat test
npx hardhat coverage
cd frontend && npm run test
cd frontend && npm run e2e
```

### 上线前

```powershell
# 真实ZK测试
cd frontend && npm run e2e:real-zk

# 冒烟测试
npm run smoke-test --network=sepolia

# 发布检查
npm run release-check --network=sepolia
```

---

## 文档链接

- **详细E2E测试指南**: `docs/E2E_TESTING_GUIDE.md`
- **测试指南**: `docs/TESTING_GUIDE.md`
- **部署指南**: `docs/DEPLOYMENT.md`
- **操作指南**: `docs/OPERATIONS_GUIDE.md`

---

## 快捷键

### Playwright UI模式

- `F5` - 运行所有测试
- `Shift+F5` - 运行当前测试
- `Ctrl+Shift+P` - 命令面板
- `Ctrl+\`` - 切换终端

### Vitest UI模式

- `R` - 重新运行所有测试
- `F` - 只运行失败的测试
- `C` - 清除控制台
- `Q` - 退出

---

**Last Updated**: 2025-12-20
**Version**: 1.0.0

**💡 提示**: 建议将此文档加入书签，方便快速查找命令！
