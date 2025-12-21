# WhisperFi 上下文延续指南（给后续 AI 开发者）

> 本文件专为下一个接手项目的 AI/开发者编写，帮助你快速掌握项目现状、技术栈、已知坑点和最佳实践。

## 📋 项目现状快照

**最后更新**: 2025-12-20 (M2 Phase 2 并行开发阶段)
**当前里程碑**: M1 已完成 ✅，M2 Phase 2 四线程并行开发已完成 ✅
**测试状态**:
- 合约测试: 103 passing (新增 withdraw-payment-chain.test.ts: 12 tests)
- 前端测试: 126 passing (新增 ProofProgressBar: 11 tests, checksum validation: 3 tests)
- E2E Playwright: 9 specs (新增 withdraw.multi-tab.playwright.ts)

**最新完成工作** (2025-12-20 下午/晚上):
1. ✅ **Thread 1 (A3.1-A3.4)**: Merkle 指标验证 - 4个任务全部完成
2. ✅ **Thread 2 (B2.2-B2.5, B3.2)**: 缓存校验 + 进度 UI - 8个任务全部完成
3. ✅ **Thread 3 (C2.3)**: 支付链路回归测试 - 完成
4. ✅ **Thread 4 (C3.1-C3.2)**: 部署配置 - 完成

---

## 🚀 快速开始（给 AI 开发者）

### 第一步：获取项目现状

```bash
# 1. 读取里程碑计划（唯一计划来源）
Read: docs/MILESTONES.md

# 2. 读取任务跟踪（了解已完成工作）
Read: docs/MASTER_TASK_TRACKING.md

# 3. 读取开发规约（必须遵循）
Read: AGENTS.md
```

### 第二步：理解技术架构

**核心技术栈**:
- **ZK-SNARKs**: Groth16 证明系统，电路位于 `circuits/withdraw.circom`
- **ERC-4337**: Account Abstraction，EntryPoint + Paymaster 架构
- **Poseidon Hash**: 跨域一致性 (circomlibjs ↔ Solidity ↔ Circom)
- **Merkle Tree**: 深度16，使用 `CircuitCompatibleMerkleTree`
- **前端**: Next.js 14 + Vitest + Playwright + Wagmi + Viem
- **合约**: Hardhat + Chai + TypeScript

**关键文件路径**:
```
contracts/
├── PrivacyPool.sol          # 主隐私池合约
├── EntryPoint.sol            # ERC-4337 入口点
└── Paymaster.sol             # 手续费赞助合约

circuits/
└── withdraw.circom           # 提款证明电路

frontend/src/
├── lib/withdraw/             # 核心提款逻辑
│   ├── logSource.ts          # 事件缓存（新增分页+重试）
│   ├── localCache.ts         # localStorage持久化（新增checksum）
│   └── cacheSync.ts          # 跨Tab同步（新增metrics）
└── components/
    ├── WithdrawCard.tsx      # 提款主组件（新增rebuild UI）
    └── ProofProgressBar.tsx  # 进度条组件（新增）

test/
├── unit/                     # 合约单元测试
├── integration/              # 集成测试（新增 withdraw-payment-chain.test.ts）
└── benchmark/                # 性能基准（新增 merkle-rebuild.bench.ts）

scripts/
├── verify-merkle-consistency.ts  # Merkle一致性验证（新增）
└── verify-zk-artifacts.ts        # ZK产物校验

config/
└── addresses.json            # 多环境合约地址注册表（新增）
```

---

## ⚠️ 已知坑点与规避方法

### 1. **路径包含空格问题** ❌
**现象**: `spawn` 在 Windows 上解析 `D:\zWenbo\AI\Private Defi` 时报错
**原因**: 空格导致参数被拆分
**解决**: 所有 `spawn` 调用使用 `shell: false`

```typescript
// ❌ 错误
spawn(cmd, args, { shell: true })

// ✅ 正确
spawn(cmd, args, { shell: false })
```

### 2. **Hardhat Gas Limit 不足** ❌
**现象**: Poseidon 合约部署失败，`ProviderError: Transaction gas limit exceeds cap`
**原因**: 默认 `blockGasLimit` 太低
**解决**: `hardhat.config.ts` 中设置 `blockGasLimit: 30000000`

```typescript
// hardhat.config.ts
networks: {
  hardhat: {
    hardfork: "cancun",
    blockGasLimit: 30000000, // ✅ 必须设置
  },
},
```

### 3. **Playwright 测试超时** ❌
**现象**: E2E 测试运行时页面关闭或超时
**原因**: Hardhat 节点启动耗时过长
**解决**:
- 对于 UI 验证测试，使用 mock 而非真实节点
- 对于全流程测试，使用 `timeout-wrapper.ps1` 脚本
- 设置合理的超时时间（60-180秒）

```typescript
// ✅ UI 验证测试模式（快速）
test.setTimeout(60_000);
window.__e2e__.mockGenerateProof = async () => ({ proof: stub, ... });

// ✅ 全流程测试模式（需要真实Hardhat节点）
test.setTimeout(180_000);
await startHardhatNode();
```

### 4. **TypeScript Import 问题 (circomlibjs)** ❌
**现象**: `import { buildPoseidon } from "circomlibjs"` 报类型错误
**原因**: circomlibjs 缺少 TypeScript 声明文件
**解决**: 使用 `require()` 并嵌入类定义

```typescript
// ❌ 错误
import { buildPoseidon } from "circomlibjs";

// ✅ 正确
const circomlibjs = require("circomlibjs");
const poseidon = await circomlibjs.buildPoseidon();
```

### 5. **Cache Checksum 在浏览器中失败** ❌
**现象**: SHA256 在浏览器环境不可用
**原因**: Node.js `crypto` 模块仅在服务端可用
**解决**: 提供 fallback 哈希函数

```typescript
function computeChecksumSync(data: { commitments: string[]; lastBlock?: string }): string {
  const payload = JSON.stringify(data);

  // ✅ Node.js 环境使用 SHA256
  if (typeof require !== "undefined") {
    try {
      const nodeCrypto = require("crypto");
      return nodeCrypto.createHash("sha256").update(payload).digest("hex");
    } catch {
      // Fall through
    }
  }

  // ✅ 浏览器环境使用简单哈希
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
```

---

## 📐 必须遵循的开发规范

### TDD 范式（Test-Driven Development）
1. **先写测试，再写实现**
2. **测试必须覆盖**:
   - 正常流程（happy path）
   - 边界情况（edge cases）
   - 错误处理（error cases）
3. **新功能必须有测试**，否则不接受

### 代码组织规则
```
新增功能时的文件命名规范:
- 合约测试: test/unit/<ContractName>.test.ts
- 集成测试: test/integration/<feature>.test.ts
- 前端组件测试: frontend/src/components/<Component>.test.tsx
- E2E测试: frontend/tests/<feature>.playwright.ts
- 工具脚本: scripts/<script-name>.ts
- 性能基准: test/benchmark/<benchmark-name>.bench.ts
```

### Git Commit 规范
```bash
# ✅ 好的 commit message
feat: Add Merkle consistency verification script with CLI args
fix: Resolve spawn path issue on Windows by disabling shell
test: Add 12 payment chain regression tests for fee splitting
docs: Update CACHE_RECOVERY.md with TTL expiration scenarios

# ❌ 差的 commit message
update code
fix bug
changes
```

### 文档更新规则
1. **新功能** → 更新 `MILESTONES.md` 和 `MASTER_TASK_TRACKING.md`
2. **已知问题** → 添加到本文件的"已知坑点"部分
3. **API 变更** → 更新相关的 `.md` 文档
4. **性能基准** → 运行 `merkle-rebuild.bench.ts` 更新 `BENCHMARKS.md`

---

## 🧪 测试策略

### 测试金字塔

```
         E2E (Playwright)
         6-10 specs
            ▲
           ███
          █████        Frontend (Vitest)
         ███████       110+ tests
        █████████           ▲
       ███████████         ███
      █████████████       █████
     ███████████████     ███████      Contract (Hardhat)
    █████████████████   █████████     90+ tests
   ███████████████████ ███████████
```

### 运行测试命令

```powershell
# 合约测试（全部）
npx hardhat test

# 合约测试（按范围）
npx hardhat test "test/unit/**/*.ts"
npx hardhat test "test/integration/**/*.ts"

# 前端测试（全部）
cd frontend && npm test

# 前端测试（特定文件）
cd frontend && npm test -- ProofProgressBar.test.tsx

# Playwright E2E（需要 timeout wrapper）
./tools/scripts/timeout-wrapper.ps1 -Command 'npx playwright test' -TimeoutSeconds 240

# 性能基准测试
npx ts-node test/benchmark/merkle-rebuild.bench.ts --sizes 100,1000,10000

# Merkle 一致性验证
npx ts-node scripts/verify-merkle-consistency.ts --contract 0x... --from-block 0 --to-block latest

# ZK 产物校验
npm run verify:zk

# 完整测试套件（Windows + uv）
uv run python tasks/test_all.py --contracts --frontend --e2e
```

### 测试覆盖率目标

| 模块 | 当前 | 目标 |
|------|------|------|
| 合约 | ~60% | ≥80% |
| 前端 | 42.89% | ≥60% |
| E2E Playwright | 9 specs | 15 specs |

---

## 🎯 如何高效接手任务

### 场景1: 用户说 "Continue"

```
1. 读取 docs/MASTER_TASK_TRACKING.md → 了解最新进展
2. 读取 docs/MILESTONES.md → 找到下一个待办任务
3. 检查是否有未完成的并行线程（查看 TodoWrite 状态）
4. 如果有多个任务，询问用户是否启动并行开发
5. 开始实现，遵循 TDD 范式
```

### 场景2: 用户提出新需求

```
1. 询问是否需要更新 MILESTONES.md
2. 如果是复杂任务，使用 EnterPlanMode 进行规划
3. 创建 TodoWrite 跟踪任务列表
4. 遵循 TDD: 先写测试 → 实现功能 → 更新文档
5. 运行完整测试套件验证
```

### 场景3: 用户报告 Bug

```
1. 先写失败的测试用例复现问题
2. 修复代码使测试通过
3. 添加回归测试防止再次出现
4. 更新 CONTEXT_CONTINUATION_GUIDE.md 的"已知坑点"部分
```

---

## 📚 关键文档索引

**规划类**:
- `docs/MILESTONES.md` - 📌 **唯一计划来源**，分形任务结构
- `docs/MASTER_TASK_TRACKING.md` - 进度日志，每日更新

**开发类**:
- `AGENTS.md` - 开发规约，10个部分，必读
- `docs/TESTING_GUIDE.md` - 测试策略与命令
- `docs/CACHE_RECOVERY.md` - 缓存恢复指南（新增）
- `docs/BENCHMARKS.md` - 性能基准（自动生成）

**运维类**:
- `docs/RUNBOOK.md` - 运维手册
- `docs/OPERATIONS_GUIDE.md` - 操作指南
- `.env.template` - 环境变量模板（新增）
- `config/addresses.json` - 合约地址注册表（新增）

**技术类**:
- `circuits/ARTIFACTS.md` - ZK 产物清单
- `scripts/verify-merkle-consistency.ts` - Merkle 验证工具（新增）
- `scripts/verify-zk-artifacts.ts` - ZK 产物校验工具

---

## 🔧 常用调试技巧

### 1. 查看缓存状态（浏览器 DevTools）

```javascript
// 打开浏览器控制台
window.__whisperfi_debug__.cacheMetrics
// 返回: { hitCount, missCount, rebuildCount, hitRate }

window.__whisperfi_debug__.corruptionDetected
// 返回: true/false

// 查看 localStorage 缓存
window.localStorage.getItem('whisperfi:commitments:31337:0x...')
```

### 2. Hardhat 调试

```bash
# 启动 Hardhat 节点（保持日志）
npx hardhat node --verbose

# 在另一个终端运行测试
npx hardhat test --network localhost

# 查看 gas 报告
REPORT_GAS=true npx hardhat test

# 运行覆盖率
npx hardhat coverage
```

### 3. Playwright 调试

```powershell
# UI 模式（可视化调试）
npx playwright test --ui

# 调试特定测试
npx playwright test withdraw.fee-flow.playwright.ts --debug

# 查看测试报告
npx playwright show-report
```

---

## 🚨 安全检查清单

在每次部署前，确保:

- [ ] `.env` 文件不在 Git 中（已添加到 `.gitignore`）
- [ ] 合约地址已验证（运行 `scripts/validate-addresses.ts`）
- [ ] ZK 产物 checksum 正确（运行 `npm run verify:zk`）
- [ ] Merkle 根与链上一致（运行 `scripts/verify-merkle-consistency.ts`）
- [ ] 所有测试通过（运行 `uv run python tasks/test_all.py`）
- [ ] 没有 TODO 或 FIXME 标记在关键路径
- [ ] 前端环境变量已设置（检查 `.env.template`）

---

## 🎓 学习路径（给新 AI 开发者）

**Day 1: 理解架构**
1. 阅读 `AGENTS.md` - 了解开发规约
2. 阅读 `docs/MILESTONES.md` - 了解项目规划
3. 运行 `npx hardhat test` - 验证环境
4. 运行 `cd frontend && npm test` - 验证前端环境

**Day 2: 掌握核心流程**
1. 阅读 `contracts/PrivacyPool.sol` - 理解主合约
2. 阅读 `frontend/src/lib/withdraw/` - 理解提款逻辑
3. 运行 E2E 测试并观察日志

**Day 3: 开始贡献**
1. 从 `docs/MILESTONES.md` 选择一个任务
2. 使用 TDD 范式实现
3. 提交前运行完整测试套件

---

## 💡 最佳实践提示

### 性能优化
- **Merkle 树重建**: 使用分页（10k blocks），避免 RPC 超时
- **缓存策略**: TTL 设置 30 分钟，自动过期清理
- **并行开发**: 独立任务使用多个 Task 线程并行

### 代码质量
- **函数长度**: 单个函数 < 50 行
- **文件长度**: 单个文件 < 500 行
- **测试覆盖**: 关键路径必须 100% 覆盖

### 文档习惯
- **每次新增功能**: 更新对应文档
- **每次修复 Bug**: 添加到"已知坑点"
- **每次性能优化**: 运行 benchmark 更新 BENCHMARKS.md

---

## 📞 遇到问题怎么办？

1. **先查文档**: 90% 的问题已在本文件或 `AGENTS.md` 中记录
2. **检查测试**: 相关测试用例往往包含最佳实践
3. **查看 Git 历史**: `git log --oneline -- <file>` 了解变更原因
4. **运行验证脚本**: `verify-merkle-consistency.ts` / `verify-zk-artifacts.ts`
5. **询问用户**: 如果以上都无法解决，向用户请求澄清

---

## 🎉 成功标志

当你完成一个任务后，应该能回答:

- ✅ 所有测试通过了吗？（`npx hardhat test` + `cd frontend && npm test`）
- ✅ 文档更新了吗？（`MASTER_TASK_TRACKING.md` + 相关 MD 文件）
- ✅ 代码遵循 TDD 范式了吗？（测试先行）
- ✅ 有新的坑点需要记录吗？（更新本文件）
- ✅ Git commit message 清晰吗？（遵循 `feat/fix/test/docs` 前缀）

如果以上都是肯定的，恭喜你！你已经做好了交接准备。

---

**最后更新**: 2025-12-20
**维护者**: Claude Sonnet 4.5
**下次更新**: 每次完成里程碑后
