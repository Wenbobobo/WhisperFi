# WhisperFi ZK 取款电路编译与链上验证操作指南（WSL 优先）

> 目的：在非 Windows 原生命令行（WSL / Docker）中生成最新的 withdraw 电路产物（wasm、zkey、Groth16Verifier.sol），并跑通链上验证测试。

## 0. 准备

- 仓库路径假定：`/mnt/d/Private-Defi`（按实际替换）。
- 关键已有文件：`circuits/powersOfTau28_hez_final_16.ptau`。
- 磁盘空间：>2GB。

需要在新环境确认/复制的最小集：
- 合约与电路相关：`contracts/`, `circuits/`, `scripts/`, `tasks/`, `test/`, `hardhat.config.ts`, `package.json`, `package-lock.json`。
- 大文件：`circuits/powersOfTau28_hez_final_16.ptau`。
- 不必复制整个 `frontend/`（体积较大）。仅当需要让前端使用最新产物时，再把生成的 `withdraw.wasm` / `withdraw_0001.zkey` 复制到宿主机的 `frontend/public/zk/`，无需迁移其余前端文件。

## 1. 依赖安装（WSL 内）

```bash
cd /mnt/d/Private-Defi
# 安装 Node 18（推荐 nvm）
nvm install 18
nvm use 18

# 安装项目依赖
npm ci
```

> 若安装慢，可先：`npm config set registry https://registry.npmmirror.com`

## 2. 编译电路与生成 zkey

```bash
# 编译 deposit / withdraw / trade 电路，产物在 circuits/build/...
npm run compile-circuits

# 基于 withdraw.r1cs + ptau 生成 zkey
npm run zkey:withdraw
```

关键产物：
- `circuits/build/withdraw/withdraw_js/withdraw.wasm`
- `circuits/build/withdraw/withdraw_0001.zkey`

## 3. 导出 Solidity 验证合约并编译

```bash
# 从 zkey 导出 Groth16Verifier.sol 并格式化
npm run verifier:withdraw

# 重新编译 Hardhat 合约
npx hardhat compile
```

可能更新的文件：`contracts/Groth16Verifier.sol`

## 4. 运行链上 ZK 验证测试

```bash
ZK_ONCHAIN=1 npx hardhat test test/integration/withdraw-onchain-verification.test.ts
```

说明：只在设置 `ZK_ONCHAIN=1` 时执行该集成测试。若资源缺失会跳过或报错。

## 5.（可选）同步前端使用的新 wasm/zkey

```bash
cp circuits/build/withdraw/withdraw_js/withdraw.wasm frontend/public/zk/withdraw.wasm
cp circuits/build/withdraw/withdraw_0001.zkey       frontend/public/zk/withdraw.zkey
```

## 6. 验证清单

- `circuits/build/withdraw/withdraw_js/withdraw.wasm` 与 `withdraw_0001.zkey` 时间戳为最新。
- `contracts/Groth16Verifier.sol` 已更新并通过 `npx hardhat compile`。
- `ZK_ONCHAIN=1` 测试通过或至少不再因 parse/资源缺失中断。
- 前端单测可选：`cd frontend && npm run test`。

## 7. 常见问题

- **Parse error “pragma circom 2.0.0 … got '.'”**：Windows 原生 circom 的已知问题；务必在 WSL 或 Docker 内执行上述命令。
- **依赖安装缓慢**：使用镜像源，再 `npm ci`。
- **测试跳过/缺资源**：检查步骤 2/3 产物是否存在；运行测试前确保已设置 `ZK_ONCHAIN=1`。

## 8. Docker 备选方案（若不使用 WSL）

在 Windows PowerShell/CMD 的仓库根目录执行：

```powershell
docker run -it --rm -v "$PWD:/work" -w /work iden3/circom bash -lc "npm ci && npm run compile-circuits && \
npx snarkjs groth16 setup circuits/build/withdraw/withdraw.r1cs \
circuits/powersOfTau28_hez_final_16.ptau \
circuits/build/withdraw/withdraw_0001.zkey"
```

返回宿主机继续：

```powershell
npm run verifier:withdraw
npx hardhat compile
ZK_ONCHAIN=1 npx hardhat test test/integration/withdraw-onchain-verification.test.ts
# 可选：复制 wasm/zkey 到 frontend/public/zk/
```

---

执行完毕后，如仍有错误，请回传最新日志（或更新 error.txt）以便后续处理。
