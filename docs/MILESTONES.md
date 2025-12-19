# WhisperFi 里程碑与任务分解（唯一进度来源）
最后更新：2025-12-19

> 用"一棵树"描述进度：4 个大阶段（可并行），每个阶段拆成可执行的子任务清单。
> 状态标识：✅ 完成 | 🔄 进行中 | ⏳ 待做 | 🔀 可并行

---

## 📊 进度概览

| 阶段 | 名称 | 完成度 | 状态 |
|------|------|--------|------|
| A | 协议 & ZK 稳定化 | 40% | 🔄 进行中 |
| B | 前端体验与可观测性 | 30% | 🔄 进行中 |
| C | AA & Relayer 商用化 | 25% | 🔄 进行中 |
| D | 运营 & 合规 | 5% | ⏳ 低优先级 |

---

## 阶段 A — 协议 & ZK 稳定化

### A1 公开输入一致性与证明产物
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| A1.1 | 对齐 withdraw 电路/合约/publicInputsHash | ✅ | - | 已完成，链上验证测试绿灯 |
| A1.2 | 生成并存档可重复的 wasm/zkey | ⏳ | 🔀 | <ul><li>记录 circom 版本（2.1.6）</li><li>记录 snarkjs 版本</li><li>记录 Powers of Tau 文件来源</li><li>输出 sha256 到 `circuits/ARTIFACTS.md`</li></ul> |
| A1.3 | 建立 checksum 校验脚本 | ⏳ | 🔀 | <ul><li>创建 `scripts/verify-zk-artifacts.ts`</li><li>校验 wasm/zkey/verifier 三件套</li><li>集成到 `npm run verify:zk`</li></ul> |

### A2 证明生成与验证可靠性
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| A2.1 | 证明时间基准测试 | ⏳ | 🔀 | <ul><li>创建 `test/benchmark/proof-generation.bench.ts`</li><li>记录 P50/P95/P99 分布</li><li>记录机器配置（CPU/RAM/Node版本）</li><li>输出表格到 `docs/BENCHMARKS.md`</li></ul> |
| A2.2 | 失败场景回归测试 | ⏳ | 🔀 | <ul><li>测试：无存款时取款</li><li>测试：commitment 丢失</li><li>测试：Merkle 路径错误</li><li>测试：fee > deposit</li><li>测试：损坏的 wasm/zkey</li><li>添加到 `test/integration/withdraw-negative.test.ts`</li></ul> |
| A2.3 | On-chain 验证长跑测试 | ⏳ | 🔀 | <ul><li>10+ 连续提款场景脚本</li><li>观察 gas 消耗变化</li><li>观察 root 漂移情况</li><li>输出图表到 `docs/pics/`</li></ul> |
| A2.4 | 性能回归报警 | ⏳ | - | <ul><li>生成 >30s 标记警告</li><li>验证 >500k gas 标记警告</li><li>集成到 CI 流程</li></ul> |

### A3 Merkle/Indexer 一致性
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| A3.1 | 双向校验脚本 | ⏳ | 🔀 | <ul><li>创建 `scripts/verify-merkle-consistency.ts`</li><li>对比 CircuitCompatibleMerkleTree 与链上 root</li><li>支持指定区块范围校验</li></ul> |
| A3.2 | 事件重放与缓存快照 | ⏳ | 🔀 | <ul><li>定义区块范围分页策略</li><li>实现失败重试机制（指数退避）</li><li>快照格式定义（JSON Schema）</li></ul> |
| A3.3 | 错误恢复流程文档 | ⏳ | 🔀 | <ul><li>缓存失效检测条件</li><li>最小重建流程</li><li>用户提示文案</li></ul> |
| A3.4 | 性能指标基线 | ⏳ | - | <ul><li>记录重放耗时</li><li>记录事件条数</li><li>记录内存占用峰值</li></ul> |
| A3.5 | Relayer/Indexer API 规范 | ⏳ | 🔀 | <ul><li>定义 `/commitments` 响应格式</li><li>定义 `/merkle-proof` 响应格式</li><li>OpenAPI 规范文档</li></ul> |

---

## 阶段 B — 前端体验与可观测性

### B1 Withdraw 流程与组件
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| B1.1 | 组件分层与单测 | ✅ | - | WithdrawCard/WithdrawForm 已拆分，单测通过 |
| B1.2 | 端到端 UI 正向流程 | ⏳ | 🔀 | <ul><li>note 输入验证</li><li>Merkle 树构建可视化</li><li>proof 生成进度</li><li>submit 交易确认</li><li>添加 Playwright 测试</li></ul> |
| B1.3 | 端到端 UI 负向流程 | ⏳ | 🔀 | <ul><li>fee > deposit 提示</li><li>无 relayer 时降级提示</li><li>proof 失败重试选项</li><li>RPC 中断优雅降级</li></ul> |
| B1.4 | Mock/Real proof 切换开关 | ⏳ | 🔀 | <ul><li>环境变量 `USE_MOCK_PROOF`</li><li>运行时动态切换</li><li>开发环境默认 mock</li></ul> |

### B2 缓存与同步
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| B2.1 | TTL + lastSyncedAt 展示 | ✅ | - | 已完成，UI 显示缓存状态 |
| B2.2 | 本地缓存校验 | ⏳ | 🔀 | <ul><li>checksum 校验逻辑</li><li>损坏时自动清空</li><li>用户友好提示</li></ul> |
| B2.3 | 多标签/多设备一致性 | ⏳ | 🔀 | <ul><li>BroadcastChannel 同步</li><li>storage 事件监听</li><li>冲突解决策略</li><li>Playwright 双标签测试</li></ul> |
| B2.4 | 缓存指标暴露 | ⏳ | 🔀 | <ul><li>缓存命中率统计</li><li>重建次数统计</li><li>DevTools 面板集成</li></ul> |
| B2.5 | 缓存重建提示流 | ⏳ | 🔀 | <ul><li>staleness 检测</li><li>一键重建按钮</li><li>重建进度条</li><li>完成状态提示</li></ul> |

### B3 可视化与错误反馈
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| B3.1 | 错误映射表 | ⏳ | 🔀 | <ul><li>合约 revert 错误码 → 文案</li><li>ZK 错误 → 文案</li><li>RPC 错误 → 文案</li><li>i18n 支持预留</li></ul> |
| B3.2 | 证明生成进度条 | ⏳ | 🔀 | <ul><li>构树阶段进度</li><li>证明生成阶段进度</li><li>提交阶段进度</li><li>预估剩余时间</li></ul> |
| B3.3 | Debug payload 导出 | ⏳ | 🔀 | <ul><li>脱敏逻辑（不含私钥/secret）</li><li>JSON 格式导出</li><li>一键复制按钮</li></ul> |

---

## 阶段 C — AA & Relayer 商用化

### C1 EntryPoint/Paymaster 安全性
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| C1.1 | 非 EntryPoint 调用防护 | ✅ | - | CallerNotEntryPoint guard 已实现并测试 |
| C1.2 | AA93/AA94 边界测试 | ✅ | - | gas & paymasterAndData 边界已测试 |
| C1.3 | 时间窗/重放/nonce 测试 | ⏳ | 🔀 | <ul><li>不同 blockTime 测试</li><li>不同 fork height 测试</li><li>nonce 重放攻击测试</li></ul> |
| C1.4 | Gas 极值测试 | ⏳ | 🔀 | <ul><li>maxFeePerGas 极大值</li><li>maxFeePerGas 极小值</li><li>maxPriorityFeePerGas 边界</li></ul> |
| C1.5 | 多 UserOp Bundle 测试 | ⏳ | 🔀 | <ul><li>prefund 竞争测试</li><li>nonce 竞争测试</li><li>聚合签名占位测试</li></ul> |

### C2 Relayer 工作流
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| C2.1 | 费率策略与上限 | ⏳ | 🔀 | <ul><li>前端 fee ≤ deposit 校验</li><li>合约 fee ≤ deposit 校验</li><li>费率配置外部化</li></ul> |
| C2.2 | 观测性基础设施 | ⏳ | 🔀 | <ul><li>请求日志格式化（pino）</li><li>交易生命周期追踪</li><li>失败重试策略定义</li></ul> |
| C2.3 | 支付链路回归 | ⏳ | 🔀 | <ul><li>recipient/relayer 分账 Hardhat 测试</li><li>前端 stub 验证</li><li>E2E 完整链路测试</li></ul> |
| C2.4 | 失败队列状态机 | ⏳ | 🔀 | <ul><li>状态定义：queued/pending/sent/failed/retry_limit</li><li>状态转换图</li><li>重试间隔策略（指数退避）</li></ul> |

### C3 部署与权限
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| C3.1 | 多环境地址册 | ⏳ | 🔀 | <ul><li>dev/test/main 三环境配置</li><li>自动生成脚本</li><li>校验脚本</li></ul> |
| C3.2 | 环境保护 | ⏳ | 🔀 | <ul><li>私钥加载规范</li><li>令牌加载规范</li><li>.env 模板文件</li><li>敏感信息检测 hook</li></ul> |
| C3.3 | Smoke Test | ⏳ | 🔀 | <ul><li>`npx hardhat test --grep smoke` 封装</li><li>`uv run tasks/test_all.py --contracts` 封装</li><li>部署后自动触发</li></ul> |
| C3.4 | 发布 Checklist | ⏳ | 🔀 | <ul><li>合约地址校验项</li><li>前端 env 校验项</li><li>ZK 产物 checksum 校验项</li><li>自动化检查脚本</li></ul> |

---

## 阶段 D — 运营 & 合规（低优先级）

### D1 合规/报告
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| D1.1 | 合规报告接口 | ⏳ | 🔀 | <ul><li>需求收集与定义</li><li>API 设计</li><li>隐私保护机制</li></ul> |
| D1.2 | 审计准备清单 | ⏳ | 🔀 | <ul><li>威胁模型文档</li><li>已知风险清单</li><li>补丁计划</li></ul> |
| D1.3 | 外部审计资料包 | ⏳ | 🔀 | <ul><li>审计范围定义</li><li>安全假设说明</li><li>资产清单</li><li>测试证据链接</li></ul> |

### D2 文档与知识库
| ID | 任务 | 状态 | 并行 | 详细步骤 |
|----|------|------|------|----------|
| D2.1 | 单一入口文档维护 | ⏳ | 🔀 | <ul><li>本文 + README 同步</li><li>定期更新机制</li></ul> |
| D2.2 | FAQ & 故障手册 | ⏳ | 🔀 | <ul><li>常见报错收集</li><li>解决步骤编写</li><li>关联测试链接</li></ul> |
| D2.3 | 贡献指南 | ⏳ | 🔀 | <ul><li>提交流程规范</li><li>测试矩阵说明</li><li>常见脚本速查表</li></ul> |

---

## 🎯 里程碑节点

### M0 ✅ 基础对齐（已完成）
- [x] ZK 资产最新
- [x] 链上验证绿灯
- [x] 测试框架建立（48 合约测试 + 38 前端测试）

### M1 🔄 核心功能稳定（目标：1 周内）
- [ ] A2.2 失败场景回归测试完成
- [ ] B1.2 端到端 UI 正向流程完成
- [ ] C1.3 时间窗/重放测试完成

### M2 ⏳ 体验优化（目标：3 周内）
- [ ] A3.1-A3.4 Merkle 指标与校验完成
- [ ] B2.2-B2.5 缓存校验与重建流程完成
- [ ] B3.1-B3.2 错误反馈与进度条完成
- [ ] C2.3 支付链路回归完成

### M3 ⏳ 商用准备（目标：6 周内）
- [ ] C3.1-C3.4 部署自动化完成
- [ ] 前端测试覆盖率 ≥ 60%
- [ ] 合约测试覆盖率 ≥ 80%
- [ ] D1.2 审计准备清单完成

---

## 🔀 并行开发建议

### 可同时推进的任务组

```
┌─────────────────────────────────────────────────────────────────┐
│                    可完全并行的开发线                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  线程 1: 协议/ZK 稳定化                                          │
│  ├── A1.2 ZK 产物存档                                           │
│  ├── A1.3 Checksum 校验脚本                                     │
│  ├── A2.1 证明时间基准测试                                       │
│  └── A2.2 失败场景回归测试                                       │
│                                                                 │
│  线程 2: 前端体验                                                │
│  ├── B1.2 端到端 UI 正向流程                                     │
│  ├── B1.3 端到端 UI 负向流程                                     │
│  ├── B3.1 错误映射表                                            │
│  └── B3.2 证明生成进度条                                         │
│                                                                 │
│  线程 3: AA/Relayer                                              │
│  ├── C1.3 时间窗/重放测试                                        │
│  ├── C1.4 Gas 极值测试                                          │
│  └── C2.1 费率策略                                              │
│                                                                 │
│  线程 4: 基础设施                                                │
│  ├── C3.1 多环境地址册                                          │
│  ├── C3.2 环境保护                                              │
│  └── D2.3 贡献指南                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 依赖关系

```
A1.1 ✅ ─┬─> A2.1 (需要稳定的 ZK 产物)
         ├─> A2.2 (需要稳定的 ZK 产物)
         └─> B1.2 (需要稳定的证明流程)

B1.1 ✅ ─┬─> B1.2 (组件基础)
         └─> B1.3 (组件基础)

C1.1 ✅ ─┬─> C1.3 (安全基础)
C1.2 ✅ ─┘
```

---

## 📝 跟踪原则

1. **新任务**：先挂到对应阶段子项，完成后在 `MASTER_TASK_TRACKING.md` 记一行
2. **新文档**：优先复用本文件层次结构，避免分裂
3. **状态更新**：每完成一个子任务，立即更新本文件状态
4. **测试先行**：每个功能开发前先写测试用例

---

## 📊 测试覆盖率目标

| 模块 | 当前 | M2 目标 | M3 目标 |
|------|------|---------|---------|
| 合约 (Hardhat) | 48 tests | 60 tests | 80 tests |
| 前端 (Vitest) | 42.89% | 55% | 60% |
| E2E (Playwright) | 3 specs | 8 specs | 15 specs |

---

*文档维护者：本文档应随代码库变更及时更新。*
