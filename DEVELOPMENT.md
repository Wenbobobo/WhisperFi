# WhisperFi 开发指南

**完整的开发文档** - 合并了开发规约、AI指南、已知坑点、测试策略

**最后更新**: 2025-12-22
**项目状态**: ✅ Sepolia 部署完成 | 🏆 ETHShenzhen 2025 Winner
**合约地址**: `0x2c932Df97Cc37bc6E402eEe90f0bE1bdC623bc60` ([Etherscan](https://sepolia.etherscan.io/address/0x2c932Df97Cc37bc6E402eEe90f0bE1bdC623bc60))

---

## 🚀 快速开始（5分钟上手）

### 新 AI 开发者接手流程

```bash
# 1. 了解项目（2分钟）
Read: README.md                    # 项目介绍
Read: docs/DEPLOYMENT.md           # 部署状态

# 2. 阅读本文件（3分钟）
Read: DEVELOPMENT.md               # 这个文件

# 3. 开始工作
Read: docs/PLANNING.md             # 查看任务
遵循 TDD 开始开发
```

### 环境准备

```bash
# 安装依赖
npm install
cd frontend && npm install && cd ..

# 配置环境变量
cp .env.template .env
# 编辑 .env，填入 SEPOLIA_RPC_URL

# 运行测试验证环境
npx hardhat test
cd frontend && npm test
```

---

## ⚠️ 必须知道的关键坑点

### 🔴 坑点 #1: Hardhat EVM Bug（最重要！）

**问题**: 当函数参数值存在于合约storage mapping时，Hardhat 报错"function selector not recognized"

**影响**:
- ❌ Hardhat 本地无法测试完整 withdraw 流程
- ✅ Sepolia 和其他真实网络正常工作

**具体现象**:
```solidity
contract PrivacyPool {
    mapping(bytes32 => bool) public rootHistory;

    function withdraw(bytes32 _proofRoot, ...) external {
        require(rootHistory[_proofRoot], "Invalid");  // 问题在这里
    }
}
```

```typescript
// ❌ FAILS on Hardhat（当 root 在 rootHistory 中）
await privacyPool.withdraw(proof, realRoot, ...);
// Error: function selector was not recognized

// ✅ WORKS on Sepolia
await privacyPool.withdraw(proof, realRoot, ...);
// 正常执行
```

**解决方案**:
```bash
# 方案 1: 使用 Sepolia 测试（推荐）
npx hardhat run scripts/deploy.ts --network sepolia

# 方案 2: Hardhat 仅测试非完整流程
# - 测试 deposit ✅
# - 测试 Merkle tree ✅
# - 测试 proof generation ✅
# - 测试 withdraw ❌（需要 Sepolia）

# 方案 3: 考虑迁移到 Anvil/Foundry（长期）
```

**测试状态**:
| 测试类型 | Hardhat | Sepolia |
|---------|---------|---------|
| Deposits | ✅ | ✅ |
| Merkle Tree | ✅ | ✅ |
| Proof Generation | ✅ | ✅ |
| Withdrawals | ❌ Bug | ✅ **已验证** |

### 🔴 坑点 #2: Gas Limit 配置

**问题**: Poseidon 合约部署需要超过默认 gas limit

**必须配置**:
```typescript
// hardhat.config.ts
networks: {
  hardhat: {
    hardfork: "cancun",
    blockGasLimit: 30000000,  // ✅ 必须设置
  },
}
```

### 🟡 坑点 #3: Windows 路径空格

**问题**: 项目路径 `D:\zWenbo\AI\Private Defi` 包含空格

**解决**:
```typescript
// ✅ 所有 spawn 调用必须使用 shell: false
spawn(cmd, args, { shell: false })

// ❌ 错误（路径被拆分）
spawn(cmd, args, { shell: true })
```

### 🟡 坑点 #4: Poseidon Hash 一致性

**关键**: JavaScript ↔ Solidity ↔ Circom 必须使用相同的 Poseidon 实现

**解决**:
```typescript
// ✅ 统一字节码生成
const poseidonContract = await buildPoseidon();
const bytecode = poseidonContract.createCode(2);  // 参数个数
```

**重要性**: 🔴 **核心基础** - 所有 commitment 和 nullifier 计算依赖此一致性

### 🟡 坑点 #5: TypeScript Import (circomlibjs)

```typescript
// ❌ 错误
import { buildPoseidon } from "circomlibjs";

// ✅ 正确
const circomlibjs = require("circomlibjs");
const poseidon = await circomlibjs.buildPoseidon();
```

### 🟢 坑点 #6: Cache Checksum 浏览器兼容性

**问题**: Node.js `crypto` 模块在浏览器中不可用

**解决**: 提供 fallback
```typescript
// ✅ Node.js 环境
if (typeof require !== "undefined") {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ✅ 浏览器环境 fallback
let hash = 0;
for (let i = 0; i < data.length; i++) {
  hash = ((hash << 5) - hash) + data.charCodeAt(i);
}
return hash.toString(16);
```

---

## 📐 开发规范

### 1. TDD 范式（Test-Driven Development）

**必须遵循**:
```
1. 先写失败的测试
2. 实现最小功能使测试通过
3. 重构优化
4. 运行完整测试套件验证
```

**测试覆盖要求**:
- 合约: 关键路径 100%，整体 ≥80%
- 前端: 核心逻辑 ≥60%
- E2E: 主要用户流程全覆盖

### 2. Git Commit 规范

```bash
# ✅ 好的 commit
feat: Add Merkle consistency verification script
fix: Resolve Hardhat withdraw function selector bug
test: Add payment chain regression tests
docs: Update deployment guide with Sepolia steps

# ❌ 差的 commit
update code
fix bug
changes
```

**格式**: `<type>: <description>`

**类型**:
- `feat`: 新功能
- `fix`: Bug 修复
- `test`: 测试相关
- `docs`: 文档更新
- `refactor`: 重构
- `perf`: 性能优化
- `chore`: 构建/工具变更

### 3. 文件命名规范

```
合约测试:     test/unit/<ContractName>.test.ts
集成测试:     test/integration/<feature>.test.ts
前端组件测试: frontend/src/components/<Component>.test.tsx
E2E 测试:     frontend/tests/<feature>.playwright.ts
工具脚本:     scripts/<script-name>.ts
性能基准:     test/benchmark/<benchmark-name>.bench.ts
```

### 4. 代码质量标准

```typescript
// ✅ 函数长度
单个函数 < 50 行

// ✅ 文件长度
单个文件 < 500 行

// ✅ 测试覆盖
关键路径必须 100% 覆盖
```

---

## 🏗️ 项目结构

```
WhisperFi/
├── contracts/              # Solidity 合约
│   ├── PrivacyPool.sol     # 主隐私池合约
│   ├── EntryPoint.sol      # ERC-4337 入口点
│   ├── Paymaster.sol       # Gas 赞助
│   └── lib/                # 工具库
├── circuits/               # ZK 电路
│   ├── withdraw.circom     # 提款证明电路
│   └── build/              # 编译产物
├── frontend/               # Next.js 应用
│   ├── src/
│   │   ├── lib/withdraw/   # 核心提款逻辑
│   │   ├── utils/crypto.ts # ZK 证明生成
│   │   └── config/contracts.ts # 合约地址
│   └── public/zk/          # ZK 产物 (wasm, zkey)
├── test/                   # 测试套件
│   ├── unit/               # 单元测试
│   ├── integration/        # 集成测试
│   └── benchmark/          # 性能基准
├── scripts/                # 部署和工具脚本
│   ├── deploy.ts           # 主部署脚本
│   ├── verify-*.ts         # 验证工具
│   └── debug/              # 调试脚本（归档）
└── docs/                   # 项目文档
    ├── DEPLOYMENT.md       # 部署指南
    ├── TESTING.md          # 测试指南
    ├── TECHNICAL.md        # 技术规范
    └── PLANNING.md         # 规划追踪
```

---

## 🧪 测试策略

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

### 测试命令

```bash
# === 合约测试 ===
npx hardhat test                               # 全部
npx hardhat test "test/unit/**/*.ts"          # 单元测试
npx hardhat test "test/integration/**/*.ts"   # 集成测试
REPORT_GAS=true npx hardhat test              # Gas 报告
npx hardhat coverage                          # 覆盖率

# === 前端测试 ===
cd frontend && npm test                       # 全部
cd frontend && npm test -- <Component>        # 特定组件
cd frontend && npm run test:coverage          # 覆盖率

# === E2E 测试 ===
npx playwright test                           # 全部
npx playwright test --ui                      # UI 模式
npx playwright test <spec> --debug            # 调试

# === Sepolia 测试 ===
npx hardhat run scripts/test-sepolia-withdraw-call.ts --network sepolia

# === 验证工具 ===
npx ts-node scripts/verify-merkle-consistency.ts
npm run verify:zk
npx ts-node scripts/validate-addresses.ts
```

---

## 🎯 典型场景处理

### 场景 1: 用户说 "Continue"

```
1. Read: docs/PLANNING.md       # 查看任务
2. 检查 TodoWrite 未完成任务
3. 继续执行或询问用户
```

### 场景 2: 用户提出新需求

```
1. 评估复杂度（是否需要 EnterPlanMode）
2. 创建 TodoWrite 任务列表
3. TDD: 写测试 → 实现 → 验证 → 更新文档
4. 运行完整测试套件
```

### 场景 3: 用户报告 Bug

```
1. 先写失败的测试用例复现
2. 修复代码使测试通过
3. 添加回归测试
4. 更新本文件"已知坑点"（如需要）
```

### 场景 4: 部署到 Sepolia

```bash
# 1. 检查余额
npx hardhat run scripts/check-sepolia-balance.ts --network sepolia

# 2. 部署
npx hardhat run scripts/deploy.ts --network sepolia

# 3. 验证
npx hardhat run scripts/test-sepolia-withdraw-call.ts --network sepolia
```

---

## 🔧 调试技巧

### 1. 浏览器调试（DevTools）

```javascript
// 缓存状态
window.__whisperfi_debug__.cacheMetrics
window.__whisperfi_debug__.corruptionDetected

// 查看 localStorage
localStorage.getItem('whisperfi:commitments:31337:0x...')
```

### 2. Hardhat 调试

```bash
npx hardhat node --verbose        # 启动节点
npx hardhat test --network localhost
REPORT_GAS=true npx hardhat test  # Gas 报告
npx hardhat coverage              # 覆盖率
```

### 3. Playwright 调试

```bash
npx playwright test --ui          # UI 模式
npx playwright test <spec> --debug
npx playwright show-report        # 查看报告
```

---

## 🚨 安全检查清单

**部署前必查**:
- [ ] `.env` 和 `config/wallet.env` 不在 Git 中
- [ ] 无硬编码私钥或 API keys
- [ ] 合约地址已验证（`scripts/validate-addresses.ts`）
- [ ] ZK 产物 checksum 正确（`npm run verify:zk`）
- [ ] Merkle 根与链上一致（`scripts/verify-merkle-consistency.ts`）
- [ ] 所有测试通过
- [ ] Gas limit 已配置（`hardhat.config.ts`）

**主网部署额外检查**:
- [ ] 使用新的、安全生成的私钥
- [ ] 考虑硬件钱包或多签
- [ ] 准备充足的 ETH（~0.5 ETH）
- [ ] 准备回滚方案
- [ ] 设置监控和报警
- [ ] 完成安全审计

---

## 📚 文档索引

| 文档 | 用途 |
|------|------|
| **README.md** | 项目介绍、架构 |
| **DEVELOPMENT.md** | 开发指南（本文件） |
| **CHANGELOG.md** | 变更历史 |
| **docs/DEPLOYMENT.md** | 部署指南 |
| **docs/TESTING.md** | 测试指南 |
| **docs/TECHNICAL.md** | 技术规范 |
| **docs/PLANNING.md** | 规划追踪 |

---

## 💡 最佳实践

### 性能优化
- Merkle 树重建: 使用分页（10k blocks）
- 缓存策略: TTL 30 分钟
- 并行开发: 独立任务并行执行

### 文档习惯
- 每次新增功能 → 更新对应文档
- 每次修复 Bug → 添加到"已知坑点"
- 每次性能优化 → 运行 benchmark
- 每次完成任务 → 更新 docs/PLANNING.md

---

## 📞 遇到问题？

```
1. 先查本文件 (90% 问题已记录)
2. 检查测试用例 (包含最佳实践)
3. 查看 Git 历史: git log --oneline -- <file>
4. 运行验证脚本
5. 询问用户
```

### 常见问题 FAQ

**Q: Hardhat 测试失败，报 "function selector not recognized"？**
A: 这是已知 Bug！参见上方"坑点 #1"，使用 Sepolia 测试。

**Q: Poseidon 部署失败，gas limit 不足？**
A: 检查 `hardhat.config.ts` 中 `blockGasLimit: 30000000`。

**Q: Sepolia 余额不足？**
A: 从水龙头获取: https://sepoliafaucet.com/

**Q: Windows spawn 报错？**
A: 使用 `{ shell: false }` 参数。

---

## 🎉 任务完成标志

完成任务后，确认：

- [ ] ✅ 所有测试通过
- [ ] ✅ 文档已更新
- [ ] ✅ 遵循 TDD 范式
- [ ] ✅ 新坑点已记录
- [ ] ✅ Git commit message 清晰
- [ ] ✅ 无安全风险
- [ ] ✅ 无回归

如果以上都是肯定的，恭喜！可以向用户汇报完成。

---

**维护者**: Claude Sonnet 4.5
**最后审查**: 2025-12-22
**下次更新**: 发现新坑点或完成主要里程碑后
