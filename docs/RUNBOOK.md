# WhisperFi Runbook（交接与日常操作）
最后更新：2025-12-13

## 0. 快速索引
- 里程碑/任务树：`MILESTONES.md`（唯一计划来源）
- 状态时间线：`MASTER_TASK_TRACKING.md`
- 架构与接口：`TECHNICAL_SPECIFICATION.md`
- 风险/整改：`CODE_REVIEW.md`
- 测试矩阵：`TESTING_GUIDE.md`

## 1. 最近完成 / 现状
- Groth16 链上 withdraw 测试绿灯，ZK 产物已重编译放回 canonical 路径。
- Paymaster/EntryPoint 单测覆盖 gas 溢出、paymasterAndData 异常；Hardhat 全套测试通过。
- 前端 Vitest 全绿；WithdrawForm harness 化，缓存测试容忍 `lastSyncedAt`。

## 2. 现行计划（对应里程碑简要摘录）
- A2：证明时间基准（P50/P95）与失败场景回归；损坏 wasm/zkey 检测。
- A3：Merkle/indexer 双向校验脚本；事件重放与缓存快照策略；恢复流程文档。
- B1/B2：端到端 UI 正/负向（fee>deposit/无 relayer/网络中断）；缓存校验与多标签一致性回归。
- C1/C2：EntryPoint 重放/时间窗/gas 极值；relayer 分账 Hardhat + 前端双验证；失败重试状态机。
- C3：地址册生成/校验脚本；部署后 smoke test 封装。

## 3. 常用命令（Windows + uv）
- 合约：`npx hardhat test` ｜ 覆盖率：`npx hardhat coverage`
- 前端：`cd frontend && npm run test`
- 统一：`uv run python tasks/test_all.py`（可加 `--coverage` / `--e2e`）
- Playwright（建议超时包装）：`tools/scripts/timeout-wrapper.ps1 -TimeoutSeconds 240 -Command "npx playwright test"`

## 4. 已知坑 / 提示
- 覆盖率跑法会自动跳过重型 ZK；需要真 ZK 时用普通 `hardhat test`。
- 确保 `.wasm/.zkey` 在 canonical 路径后再开启 on-chain 验证测试。
- Playwright 依赖 `/e2e/withdraw` 路由与 wallet mock；仍需超时保护避免浏览器悬挂。

## 5. 交接提醒
- 新任务：先挂 `MILESTONES.md`，完成后在 `MASTER_TASK_TRACKING.md` 记一行。
- 新文档：优先补充到现有权威文件；如需新文件，更新 `docs/README.md` 并归档旧版。***
