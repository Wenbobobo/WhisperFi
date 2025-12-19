# WhisperFi 操作指南（本地/WSL/ZK/演示）
最后更新：2025-12-13

## 0. 适用范围与结构
- 面向需要本地/WSL 运行、编译 ZK、做演示的开发者。
- 章节：依赖与环境 → 本地部署 → ZK/链上验证 → 演示/Demo → 常见故障。
- 原文件已合并：`WSL_ZK_ONCHAIN_GUIDE.md`、`DEMO_SETUP_GUIDE.md`、`LOCAL_DEPLOYMENT_GUIDE_zh.md`。

## 1. 依赖与环境
- Node 18+，pnpm/npm 任一；Python 3.11+（uv 可选）；git。
- Windows/WSL 推荐：安装 `circom` 2.1.x，`snarkjs`；Hardhat 全局无需安装（项目自带）。
- 环境变量：在根目录 `.env.local` / `.env`（未提交）填写 RPC、私钥、Flashbots 相关密钥；不要提交到仓库。

## 2. 本地部署（中文步骤）
1) 安装依赖  
   - 根目录：`npm install`  
   - 前端：`cd frontend && npm install`
2) 合约与测试  
   - 全量：`npx hardhat test`  
   - 覆盖率：`npx hardhat coverage`（重型 ZK 会被跳过以防超时）
3) 前端测试  
   - `cd frontend && npm run test`
4) 统一入口（Windows + uv）  
   - `uv run python tasks/test_all.py`（可加 `--coverage` / `--e2e`）

## 3. ZK 编译与链上验证
- 编译 withdraw 电路  
  - `npm run compile-circuits`（或在 WSL 内同命令）；产物输出到 `circuits/withdraw_js/withdraw.wasm` 与 `circuits/withdraw_0001.zkey`。
- 校验产物  
  - 记录生成命令与 sha256；建议脚本化 checksum（参见 `MILESTONES.md` A1/A2）。
- 链上验证测试  
  - `npx hardhat test test/integration/withdraw-onchain-verification.test.ts`（需产物存在）。

## 4. 演示 / Demo
- 目标：演示存款→取款的完整流程，含缓存/错误提示。  
- 步骤示例：  
  1) 启动本地 Hardhat 节点（若需要实时合约交互）。  
  2) 部署（如有脚本）或直接使用默认地址配置。  
  3) 前端 `npm run dev`，访问页面，输入 note，生成证明并提交。  
  4) 若需要 mock：使用 `window.__e2e__` 提供的 `mockAccount`、`mockGenerateProof`、`submitWithdrawalOverride`。  
- Playwright 演示：建议 `tools/scripts/timeout-wrapper.ps1 -TimeoutSeconds 240 -Command "npx playwright test frontend/tests/withdraw.fee-flow.playwright.ts"`。

## 5. WSL 补充要点
- 在 WSL 内执行 circom/snarkjs 可减少 Windows 下编译问题；产物复制回 Windows 根目录时保持路径一致（见上文 canonical 路径）。
- 如需远程/WSL 编译：`ssh user@host "cd whisperfi && npm run compile-circuits"`，完成后将 wasm/zkey/Verifier 拷回对应目录。

## 6. 常见故障
- 证明生成失败 / 找不到 commitment：先点击 “Reset commitment cache”，确认链上已有存款事件，再重试。
- wasm/zkey 缺失：检查 `circuits/withdraw_js/withdraw.wasm` 与 `circuits/withdraw_0001.zkey` 是否存在；如无，重新编译。
- Playwright 卡住：使用超时包装脚本；确保 8545 端口空闲。
- 覆盖率报错 stack-too-deep：设置 `SOLIDITY_COVERAGE=1`（项目已在测试脚本处理），或改用普通 `hardhat test`。
