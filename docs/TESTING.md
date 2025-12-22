# WhisperFi 测试指南

**完整测试文档** - 合并了所有测试相关内容

---

## 测试策略

### 测试金字塔

```
        E2E (9 specs)
           ▲
          ███
         █████        Frontend (~120 tests)
        ███████            ▲
       █████████          ███
      ███████████        █████      Contracts (~90 tests)
     █████████████      ███████
    ███████████████    █████████
```

### 当前覆盖率

| 模块 | 测试数 | 覆盖率 | 状态 |
|------|--------|--------|------|
| 合约 | ~90 | ~60% | ✅ |
| 前端 | ~120 | 42.89% | ✅ |
| E2E | 9 specs | - | ✅ |

---

## 快速测试命令

```bash
# === 全部测试 ===
npx hardhat test && cd frontend && npm test

# === 合约测试 ===
npx hardhat test                            # 全部
npx hardhat test "test/unit/**/*.ts"       # 单元测试
npx hardhat test "test/integration/**/*.ts" # 集成测试
REPORT_GAS=true npx hardhat test           # Gas 报告
npx hardhat coverage                       # 覆盖率

# === 前端测试 ===
cd frontend
npm test                                   # 全部
npm test -- <Component>                    # 特定组件
npm run test:coverage                      # 覆盖率

# === E2E 测试 ===
npx playwright test                        # 全部
npx playwright test --ui                   # UI 模式
npx playwright test <spec> --debug         # 调试

# === Sepolia 测试 ===
npx hardhat run scripts/test-sepolia-withdraw-call.ts --network sepolia
```

---

## 测试限制（Hardhat Bug）

⚠️ **重要**: Hardhat 本地无法测试完整 withdraw 流程

| 测试类型 | Hardhat | Sepolia | 说明 |
|---------|---------|---------|------|
| Deposits | ✅ | ✅ | 正常 |
| Merkle Tree | ✅ | ✅ | 正常 |
| Proof Generation | ✅ | ✅ | 正常 |
| Withdrawals | ❌ | ✅ | Hardhat Bug |

**解决方案**: 使用 Sepolia 进行完整测试

---

## E2E 测试（Playwright）

### 测试套件

```
frontend/tests/
├── deposit.playwright.ts                # 存款流程
├── withdraw.fee-flow.playwright.ts      # 提款手续费
├── withdraw.merkle-tree.playwright.ts   # Merkle 树
├── withdraw.multi-tab.playwright.ts     # 多标签同步
└── ...                                  # 其他测试
```

### 运行

```bash
# 全部 E2E
npx playwright test

# UI 模式（推荐）
npx playwright test --ui

# 调试模式
npx playwright test <spec> --debug

# 查看报告
npx playwright show-report
```

---

## 性能测试

```bash
# Merkle 树重建基准
npx ts-node test/benchmark/merkle-rebuild.bench.ts --sizes 100,1000,10000
```

---

## 验证工具

```bash
# Merkle 一致性
npx ts-node scripts/verify-merkle-consistency.ts --contract 0x... --from-block 0 --to-block latest

# ZK 产物校验
npm run verify:zk

# 地址验证
npx ts-node scripts/validate-addresses.ts

# Hash 验证
npx ts-node scripts/verify-hash.ts
```

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2025-12-22
