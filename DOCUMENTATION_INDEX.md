# 📚 WhisperFi 文档快速索引

**最后更新**: 2025-12-22 | **项目状态**: ✅ Sepolia 部署完成

---

## 🚀 新开发者 / 新 AI？从这里开始！

### 第一步：了解项目（5 分钟）

```
1. PROJECT_STATUS.md          ⭐ 项目现状快照（必读）
2. README.md                     项目介绍、架构、特性
3. HARDHAT_BUG_REPORT.md        关键 Bug 说明
```

### 第二步：准备开发（10 分钟）

```
4. docs/CONTEXT_CONTINUATION_GUIDE.md  ⭐ AI 开发者完整指南（必读）
5. docs/TESTING_GUIDE.md                测试策略和命令
6. docs/SEPOLIA_DEPLOYMENT.md          部署指南
```

### 第三步：开始工作

```
7. docs/MILESTONES.md                   查看下一个任务
8. docs/MASTER_TASK_TRACKING.md        查看最新进展
9. 遵循 TDD 开始实现
```

---

## 📂 根目录文档（按用途分类）

### 🔴 核心文档（必读）

| 文档 | 说明 | 用途 |
|------|------|------|
| **PROJECT_STATUS.md** ⭐ | 项目现状快照 | 快速了解当前状态 |
| **README.md** | 项目主文档 | 了解项目架构和特性 |
| **README_CN.md** | 中文版本 | 中文读者 |

### 🟡 技术报告（参考）

| 文档 | 说明 | 阅读场景 |
|------|------|----------|
| **HARDHAT_BUG_REPORT.md** | Hardhat EVM Bug 详细分析 | 遇到测试问题时 |
| **SEPOLIA_TEST_REPORT.md** | Sepolia 部署测试报告 | 了解部署状态 |
| **CLEANUP_SUMMARY.md** | 代码清理工作总结 | 了解清理历史 |
| **WORKAROUND.md** | Hardhat bug 变通方案 | 寻找测试替代方案 |

### 🟢 开发规约

| 文档 | 说明 | 用途 |
|------|------|------|
| **AGENTS.md** | 开发规约与工程原则 | 了解代码规范 |

---

## 📁 docs/ 目录重要文档

### ⭐ 最重要

- **CONTEXT_CONTINUATION_GUIDE.md** - AI 开发者接手指南（必读！）
- **README.md** - 完整文档索引

### 🔧 操作指南

- **TESTING_GUIDE.md** - 测试策略、命令、覆盖率
- **SEPOLIA_DEPLOYMENT.md** - Sepolia 部署完整指南
- **OPERATIONS_GUIDE.md** - 运维指南
- **RUNBOOK.md** - 运维手册

### 📊 规划追踪

- **MILESTONES.md** - 里程碑计划
- **MASTER_TASK_TRACKING.md** - 任务跟踪日志

### 🏗️ 技术规范

- **TECHNICAL_SPECIFICATION.md** - 架构和接口规范
- **CODE_REVIEW.md** - 代码审查清单
- **BENCHMARKS.md** - 性能基准

### 🗄️ 归档

- **archive/** - 历史文档归档
  - `2025-12-22-reports/` - 旧报告文档
  - `aa/` - AA 入门教程
  - `zk/` - ZK 入门教程
  - 早期规划和设计文档

---

## 🎯 常见场景快速导航

### 场景：用户说 "Continue"

```bash
1. Read: PROJECT_STATUS.md              # 了解当前状态
2. Read: docs/MASTER_TASK_TRACKING.md  # 查看最新进展
3. 检查 TodoWrite 是否有未完成任务
4. 继续执行或询问用户下一步
```

### 场景：Context 续接

```bash
1. Read: PROJECT_STATUS.md                    # 项目快照
2. Read: docs/CONTEXT_CONTINUATION_GUIDE.md  # 开发指南
3. Read: docs/MASTER_TASK_TRACKING.md        # 最新进展
4. 询问用户："需要继续之前的任务，还是有新需求？"
```

### 场景：部署到 Sepolia

```bash
1. Read: docs/SEPOLIA_DEPLOYMENT.md  # 部署指南
2. 检查余额: npx hardhat run scripts/check-sepolia-balance.ts --network sepolia
3. 部署: npx hardhat run scripts/deploy.ts --network sepolia
```

### 场景：测试失败排查

```bash
1. Read: HARDHAT_BUG_REPORT.md              # 查看已知问题
2. Read: docs/TESTING_GUIDE.md              # 查看测试策略
3. Read: docs/CONTEXT_CONTINUATION_GUIDE.md # 查看"已知坑点"部分
```

### 场景：了解技术架构

```bash
1. Read: README.md                           # 整体架构
2. Read: docs/TECHNICAL_SPECIFICATION.md    # 详细规范
3. Read: contracts/PrivacyPool.sol          # 主合约
4. Read: circuits/withdraw.circom           # ZK 电路
```

---

## 🚨 关键警告与坑点

### ⚠️ Hardhat Bug
- **问题**: Withdraw 函数在 Hardhat 本地无法完整测试
- **解决**: 使用 Sepolia 测试网
- **详情**: `HARDHAT_BUG_REPORT.md`

### ⚠️ Gas Limit
- **问题**: Poseidon 部署需要高 gas limit
- **解决**: `hardhat.config.ts` 设置 `blockGasLimit: 30000000`
- **详情**: `docs/CONTEXT_CONTINUATION_GUIDE.md`

### ⚠️ Windows 路径空格
- **问题**: 项目路径包含空格导致 spawn 错误
- **解决**: 所有 spawn 使用 `{ shell: false }`
- **详情**: `docs/CONTEXT_CONTINUATION_GUIDE.md`

---

## 📞 快速帮助

| 问题 | 查看文档 |
|------|----------|
| 项目现状？ | `PROJECT_STATUS.md` |
| 如何部署？ | `docs/SEPOLIA_DEPLOYMENT.md` |
| 如何测试？ | `docs/TESTING_GUIDE.md` |
| 遇到 Bug？ | `HARDHAT_BUG_REPORT.md` |
| 已知坑点？ | `docs/CONTEXT_CONTINUATION_GUIDE.md` |
| 合约地址？ | `PROJECT_STATUS.md` 或 `frontend/src/config/contracts.ts` |
| 下一步任务？ | `docs/MILESTONES.md` |
| AI 开发指南？ | `docs/CONTEXT_CONTINUATION_GUIDE.md` ⭐ |

---

## 📝 文档维护

### 更新规则

```
部署变更       → 更新 PROJECT_STATUS.md
发现新坑点     → 更新 CONTEXT_CONTINUATION_GUIDE.md
新增功能       → 更新 TECHNICAL_SPECIFICATION.md + MILESTONES.md
Context 续接   → 更新 PROJECT_STATUS.md + MASTER_TASK_TRACKING.md
```

### 归档规则

```
过时文档      → 移至 docs/archive/
重复内容      → 合并到主文档，删除副本
临时文档      → 完成后归档或删除
```

---

**完整文档索引**: `docs/README.md`
**维护者**: Claude Sonnet 4.5
**最后审查**: 2025-12-22

---

## 🎉 就这么简单！

新开发者或 AI 只需读 3 个文档即可开始：
1. **PROJECT_STATUS.md** - 知道我们在哪
2. **README.md** - 知道我们在做什么
3. **docs/CONTEXT_CONTINUATION_GUIDE.md** - 知道怎么做

其他文档按需查阅即可。
