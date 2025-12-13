# WhisperFi 任务跟踪（精简版）
唯一计划来源：`docs/MILESTONES.md`。本文件只记录里程碑的完成/变更日志。

最后更新：2025-12-13  
状态：核心功能全绿，进入“协议/前端/AA 并行打磨”阶段。

## 近期进展
- 2025-12-13
  - Groth16 链上验证测试绿灯（公输入哈希与 calldata 导出对齐）。
  - ZK 产物（wasm/zkey）已重编译并放置在 canonical 路径；多余副本清理。
  - Paymaster/EntryPoint 单测增加 gas 溢出与 paymasterAndData 异常用例。
  - 前端 Vitest 全绿，WithdrawForm Harness 化；缓存测试宽容 `lastSyncedAt`。
  - 文档整合：新增 `RUNBOOK.md`、`OPERATIONS_GUIDE.md`；`DEV_HANDOVER_NOTES.md`/`NEXT_DEV_NOTES.md` 迁移为 stub；`docs/aa`、`docs/zk` 归档。
- 2025-11-07
  - Playwright fee-flow / cache-sync 用例稳定（超时包装器脚本启用）。
  - WithdrawCard 支持模拟账户回退；缓存 TTL/lastSyncedAt UI 持续显示。
- 2025-11-03
  - 文档索引与归档完成；核心计划集中到 TASK / NEXT_DEV / HANDOVER。

## 快照（与里程碑对应）
- 协议/ZK：电路-合约公输入一致；on-chain withdraw 集成测试通过；ZK 资产在仓库 canonical 路径。
- 前端：Withdraw 组件拆分完成；缓存 TTL/lastSyncedAt；负向提示覆盖。
- AA/Relayer：非 EntryPoint 调用防护、AA93/AA94 边界已测；进一步 gas/timestamp/replay 场景待补。
- 文档：索引、交接、测试指南保持最新；新里程碑树见 `MILESTONES.md`。

## 待办（详见 MILESTONES.md）
- A2 证明基准与失败场景回归
- A3 Merkle/indexer 与缓存快照策略
- B1/B2 端到端 UI 流程与缓存校验
- C1/C2 更多 AA 边界 + relayer 分账回归
- C3 地址册/部署 smoke 自动化

## 维护规则
- 新任务/里程碑：更新 `MILESTONES.md`，在此记录一行日期+摘要。
- 废弃/完成任务：在 `MILESTONES.md` 勾选；此处补一句“已完成”说明即可。
