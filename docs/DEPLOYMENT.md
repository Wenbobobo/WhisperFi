# WhisperFi 部署指南

**完整部署文档** - 合并了所有部署相关内容

---

## 当前部署状态

### Sepolia 测试网 ✅ 已部署

- **网络**: Sepolia (Chain ID: 11155111)
- **PrivacyPool**: `0x2c932Df97Cc37bc6E402eEe90f0bE1bdC623bc60`
- **Etherscan**: https://sepolia.etherscan.io/address/0x2c932Df97Cc37bc6E402eEe90f0bE1bdC623bc60
- **部署日期**: 2025-12-22
- **Gas 消耗**: ~0.04 ETH
- **状态**: ✅ 所有功能验证通过

### 所有合约地址

```typescript
PoseidonHasher:      0xc335E47Febb4dB91973918DCcaF1194e29787f5f
PoseidonHasher5:     0xe3ad03466D2D2010110c46736E63e45e4175FcC4
Groth16Verifier:     0xe77Cc2398420C98CF4724f74dC376b87F34d9fdA
Executor:            0x5b673e0482a68aeC2C86a18252f904fB9010Aa1b
EntryPoint:          0xcEc9136Fe194287Ed34ed1C83094819249AD1D5A
SmartAccountFactory: 0x73A227f2936b0E7d04D602544899254789d066Ad
Paymaster:           0x8422D6E452166f4910cB29E02E832316B6216236
```

---

## 快速部署

### 1. 环境准备

```bash
# 配置环境变量
cp .env.template .env

# 编辑 .env，设置:
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
# PRIVATE_KEY=your_key_without_0x

# 配置钱包（可选，自动从 config/wallet.env 加载）
# config/wallet.env:
# ADDRESS=0x...
# KEY=your_key
```

### 2. 检查余额

```bash
npx hardhat run scripts/check-sepolia-balance.ts --network sepolia

# 需要至少 0.5 ETH 用于部署
# 获取测试 ETH:
# - https://sepoliafaucet.com/
# - https://www.alchemy.com/faucets/ethereum-sepolia
```

### 3. 部署合约

```bash
npx hardhat run scripts/deploy.ts --network sepolia

# 自动执行:
# 1. 部署 Poseidon Hasher
# 2. 部署 Groth16 Verifier
# 3. 部署 PrivacyPool
# 4. 部署 AA 相关合约
# 5. 更新 frontend/src/config/contracts.ts
```

### 4. 验证部署

```bash
# 验证 withdraw 函数
npx hardhat run scripts/test-sepolia-withdraw-call.ts --network sepolia

# 验证合约地址
npx ts-node scripts/validate-addresses.ts

# 验证 Merkle 一致性
npx ts-node scripts/verify-merkle-consistency.ts
```

---

## 本地开发（Hardhat）

⚠️ **重要**: 由于 Hardhat EVM bug，完整 withdraw 测试必须在 Sepolia 上进行

```bash
# 启动本地节点
npx hardhat node

# 在另一个终端部署
npx hardhat run scripts/deploy.ts --network localhost

# 运行测试（部分功能）
npx hardhat test

# ✅ 可测试: deposit, merkle tree, proof generation
# ❌ 无法测试: 完整 withdraw 流程（需要 Sepolia）
```

---

## 主网部署准备

### 安全检查清单

- [ ] 完成安全审计
- [ ] Gas 优化审查
- [ ] 使用新的安全私钥
- [ ] 考虑硬件钱包/多签
- [ ] 准备充足 ETH（~0.5 ETH）
- [ ] 设置监控和报警
- [ ] 准备回滚方案
- [ ] 所有测试通过
- [ ] 文档完整

### 部署步骤

```bash
# 1. 更新配置
# .env: MAINNET_RPC_URL

# 2. 检查余额
npx hardhat run scripts/check-balance.ts --network mainnet

# 3. 部署（谨慎！）
npx hardhat run scripts/deploy.ts --network mainnet

# 4. 验证
npx hardhat verify --network mainnet CONTRACT_ADDRESS
```

---

## 故障排除

### Gas Limit 不足

```typescript
// hardhat.config.ts
networks: {
  hardhat: {
    blockGasLimit: 30000000,  // 必须设置
  },
}
```

### RPC 连接失败

- 检查 RPC URL 是否正确
- 尝试备用 RPC 端点
- 检查 API 限额

### 余额不足

- 从水龙头获取测试 ETH
- 检查 gas price 设置

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2025-12-22
