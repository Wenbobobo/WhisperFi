# WhisperFi 文档索引

<<<<<<< Updated upstream
## 1) Active, Single Sources of Truth
- `../AGENTS.md` — **开发规约与工程原则**（项目结构、TDD、代码风格、AI Agent 指南）。
- `MILESTONES.md` — 唯一的里程碑/任务树，含可并行提示与时间目标。
- `MASTER_TASK_TRACKING.md` — 每次迭代的完成记录（简短变更日志），指向 `MILESTONES.md`。
- `TECHNICAL_SPECIFICATION.md` — 架构与接口权威说明（合约、ZK、电路、前端契约）。
- `CODE_REVIEW.md` — 风险与整改清单。
- `RUNBOOK.md` — 最近交接与日常操作（取代 DEV_HANDOVER_NOTES/NEXT_DEV_NOTES）。
- `TESTING_GUIDE.md` — 测试矩阵与命令。
- `OPERATIONS_GUIDE.md` — 部署/WSL/ZK/演示的综合操作指南。
=======
**最后更新**: 2025-12-22
**项目状态**: ✅ Sepolia 部署完成 | 🏆 ETHShenzhen 2025 Winner (1st Place)
>>>>>>> Stashed changes

---

## 🚀 快速导航（新开发者从这里开始）

### 1️⃣ 立即阅读（按顺序）

1. **`../PROJECT_STATUS.md`** ⭐ - 项目现状快照，从这里开始！
2. **`../README.md`** - 项目介绍、架构、技术特性
3. **`CONTEXT_CONTINUATION_GUIDE.md`** - AI 开发者接手指南（必读！）
4. **`../HARDHAT_BUG_REPORT.md`** - 关键 Bug 说明
5. **`../SEPOLIA_TEST_REPORT.md`** - 最新部署测试报告

### 2️⃣ 重要参考文档

- **`../CLEANUP_SUMMARY.md`** - 代码清理工作总结
- **`SEPOLIA_DEPLOYMENT.md`** - Sepolia 部署完整指南
- **`TESTING_GUIDE.md`** - 测试策略和命令
- **`../WORKAROUND.md`** - Hardhat bug 变通方案

### 3️⃣ 技术文档

- **`TECHNICAL_SPECIFICATION.md`** - 技术规范和架构
- **`OPERATIONS_GUIDE.md`** - 运维指南
- **`RUNBOOK.md`** - 运维手册
- **`../circuits/ARTIFACTS.md`** - ZK 产物清单

---

## 📁 文档分类

### 🔴 核心文档（Single Source of Truth）

这些文档是唯一信息源，需要持续维护更新：

| 文档 | 用途 | 维护频率 |
|------|------|----------|
| **PROJECT_STATUS.md** | 项目现状、合约地址、已知问题 | Context 续接前 |
| **CONTEXT_CONTINUATION_GUIDE.md** | AI 开发者接手指南、坑点汇总 | 发现新坑点时 |
| **HARDHAT_BUG_REPORT.md** | Hardhat EVM Bug 详细分析 | 不变（已完成） |
| **SEPOLIA_TEST_REPORT.md** | Sepolia 部署和测试报告 | 重新部署时 |
| **CLEANUP_SUMMARY.md** | 代码清理详情记录 | 不变（历史记录） |

### 🟡 操作文档（活跃使用）

日常开发和运维使用的文档：

- **TESTING_GUIDE.md** - 测试策略、命令、覆盖率要求
- **SEPOLIA_DEPLOYMENT.md** - Sepolia 部署步骤和故障排除
- **OPERATIONS_GUIDE.md** - 运维操作指南
- **RUNBOOK.md** - 日常运维手册

### 🟢 技术规范（参考）

技术细节和架构说明：

- **TECHNICAL_SPECIFICATION.md** - 架构、接口、合约规范
- **BENCHMARKS.md** - 性能基准测试结果
- **TESTING_QUICK_REFERENCE.md** - 测试命令快速参考

### 🔵 历史文档（归档）

保留用于历史参考，不再更新：

- **archive/** - 所有归档文档
  - 早期项目规划（PROJECT_PLAN.md, ROADMAP.md）
  - PPT 和演示材料
  - AA/ZK 入门教程
  - 旧版技术设计
  - 已完成的调查报告

---

## 🗂️ 根目录文档说明

### README 系列

- **README.md** - 英文主文档（项目介绍、架构、特性）
- **README_CN.md** - 中文版本

### 报告系列（2025-12-22 最新）

- **PROJECT_STATUS.md** ⭐ - **项目现状快照**（从这里开始！）
- **SEPOLIA_TEST_REPORT.md** - Sepolia 部署测试报告
- **CLEANUP_SUMMARY.md** - 代码清理工作总结
- **HARDHAT_BUG_REPORT.md** - Hardhat Bug 详细分析
- **WORKAROUND.md** - Bug 变通方案

### 历史报告（归档参考）

- **INVESTIGATION_SUMMARY.md** - Bug 调查过程（8小时）
- **BUGFIX_SUMMARY.md** - 修复工作总结
- **IMPLEMENTATION_SUMMARY.md** - 实现工作总结
- **AGENTS.md** - 开发规约（如果存在）

---

## 📊 文档维护规则

### 1. 何时更新文档？

```
新增功能     → 更新 TECHNICAL_SPECIFICATION.md
修复 Bug      → 更新 CONTEXT_CONTINUATION_GUIDE.md 的"已知坑点"
部署变更      → 更新 PROJECT_STATUS.md
测试策略变更  → 更新 TESTING_GUIDE.md
性能优化      → 运行 benchmark，更新 BENCHMARKS.md
Context 续接  → 更新 PROJECT_STATUS.md
```

### 2. 何时归档文档？

```
文档过时     → 移至 archive/
被新文档取代 → 移至 archive/
仅历史参考   → 移至 archive/
```

### 3. 何时创建新文档？

```
评估标准:
1. 信息不适合现有文档
2. 内容足够独立和重要
3. 需要长期维护

否则: 补充到现有文档，避免碎片化
```

---

## 🔍 常见问题快速查找

### Q: 项目当前是什么状态？
**A**: 阅读 `../PROJECT_STATUS.md`

### Q: 如何部署到 Sepolia？
**A**: 阅读 `SEPOLIA_DEPLOYMENT.md`

### Q: 为什么 Hardhat 测试失败？
**A**: 阅读 `../HARDHAT_BUG_REPORT.md`

### Q: 如何运行测试？
**A**: 阅读 `TESTING_GUIDE.md` 或 `TESTING_QUICK_REFERENCE.md`

### Q: 合约地址是什么？
**A**: 阅读 `../PROJECT_STATUS.md` 或 `../frontend/src/config/contracts.ts`

### Q: 有哪些已知坑点？
**A**: 阅读 `CONTEXT_CONTINUATION_GUIDE.md` 的"已知坑点"部分

### Q: 性能基准是什么？
**A**: 阅读 `BENCHMARKS.md`

### Q: AI 开发者如何快速上手？
**A**: 阅读 `CONTEXT_CONTINUATION_GUIDE.md`

---

## 📂 完整文档树

```
WhisperFi/
├── README.md                              # 项目主文档
├── README_CN.md                           # 中文版本
├── PROJECT_STATUS.md                      # ⭐ 项目现状快照（从这里开始）
├── SEPOLIA_TEST_REPORT.md                # Sepolia 部署报告
├── CLEANUP_SUMMARY.md                    # 清理工作总结
├── HARDHAT_BUG_REPORT.md                 # Hardhat Bug 分析
├── WORKAROUND.md                         # Bug 变通方案
├── INVESTIGATION_SUMMARY.md              # 调查过程（归档）
├── BUGFIX_SUMMARY.md                     # 修复总结（归档）
├── IMPLEMENTATION_SUMMARY.md             # 实现总结（归档）
└── docs/
    ├── README.md                         # 本文件 - 文档索引
    ├── CONTEXT_CONTINUATION_GUIDE.md    # ⭐ AI 开发者指南（必读）
    ├── SEPOLIA_DEPLOYMENT.md            # Sepolia 部署指南
    ├── TESTING_GUIDE.md                 # 测试策略
    ├── TESTING_QUICK_REFERENCE.md       # 测试命令快速参考
    ├── TECHNICAL_SPECIFICATION.md       # 技术规范
    ├── OPERATIONS_GUIDE.md              # 运维指南
    ├── RUNBOOK.md                       # 运维手册
    ├── BENCHMARKS.md                    # 性能基准
    ├── CODE_REVIEW.md                   # 代码审查清单
    ├── MILESTONES.md                    # 里程碑计划
    ├── MASTER_TASK_TRACKING.md          # 任务跟踪
    └── archive/                         # 归档文档
        ├── _ARCHIVE_PLAN.md             # 归档计划
        ├── aa/                          # AA 入门教程
        ├── zk/                          # ZK 入门教程
        ├── PROJECT_PLAN.md              # 早期项目规划
        ├── ROADMAP.md                   # 旧版路线图
        ├── E2E_TESTING_GUIDE.md         # 旧 E2E 指南
        └── ...                          # 其他历史文档
```

---

## 🎯 文档使用建议

### 给新加入的 AI 开发者

```bash
# Day 1: 了解项目现状
1. Read: ../PROJECT_STATUS.md           # 项目状态
2. Read: ../README.md                   # 项目介绍
3. Read: CONTEXT_CONTINUATION_GUIDE.md  # 开发指南

# Day 2: 理解技术架构
1. Read: TECHNICAL_SPECIFICATION.md     # 技术规范
2. Read: ../contracts/PrivacyPool.sol   # 主合约
3. Read: ../circuits/withdraw.circom    # ZK 电路

# Day 3: 开始开发
1. Read: TESTING_GUIDE.md              # 测试策略
2. Read: MILESTONES.md                 # 下一个任务
3. 遵循 TDD 开始实现
```

### 给用户

- **查看项目状态**: `PROJECT_STATUS.md`
- **了解技术方案**: `README.md`
- **部署到测试网**: `docs/SEPOLIA_DEPLOYMENT.md`
- **运行测试**: `docs/TESTING_GUIDE.md`

---

## 🔄 文档更新历史

### v3.0.0 (2025-12-22)
- ✅ 创建 PROJECT_STATUS.md（项目状态快照）
- ✅ 更新 CONTEXT_CONTINUATION_GUIDE.md v2.0.0
- ✅ 添加 Sepolia 部署状态
- ✅ 添加 Hardhat Bug 详细说明
- ✅ 重组文档结构和索引

### v2.0.0 (2025-12-20)
- ✅ M2 Phase 2 并行开发完成
- ✅ 添加缓存恢复、进度 UI 等新功能文档
- ✅ 更新测试覆盖率

### v1.0.0 (Earlier)
- ✅ 初始文档体系建立
- ✅ 核心技术文档完成

---

## 📞 文档反馈

如果你发现：
- 文档信息过时
- 文档位置不合理
- 文档内容重复
- 缺少重要信息

请更新本文件并提交 commit，或通知团队维护者。

---

**维护者**: Claude Sonnet 4.5
**联系方式**: GitHub Issues
**最后审查**: 2025-12-22
