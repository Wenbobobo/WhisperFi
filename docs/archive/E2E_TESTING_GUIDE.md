# 🔧 完整的端到端测试指南

## 当前状态分析

✅ **后端密码学**: 完全正确，承诺生成一致  
❌ **前端连接**: 没有连接到有数据的网络

## 解决方案：完整的端到端测试

### 步骤 1: 启动本地区块链网络

```bash
# 在终端 1 中运行（保持运行）
cd "d:\zWenbo\AI\Private Defi"
npx hardhat node
```

这将启动本地区块链并显示预置账户。

### 步骤 2: 部署合约到本地网络

```bash
# 在终端 2 中运行
cd "d:\zWenbo\AI\Private Defi"
npx hardhat run scripts\deploy-and-test.js --network localhost
```

这将：
- 部署所有合约到本地网络
- 自动生成前端配置文件
- 创建测试存款
- 输出合约地址

### 步骤 3: 更新前端配置

脚本会自动创建 `frontend/src/config/contracts.ts` 文件，包含正确的合约地址。

### 步骤 4: 更新前端组件

将前端组件更新为使用新的配置文件而不是硬编码地址。

### 步骤 5: 设置 MetaMask

1. 连接到 localhost:8545
2. 导入 Hardhat 提供的测试账户
3. 确保有足够的测试 ETH

### 步骤 6: 测试前端

1. 启动前端：`cd frontend && npm run dev`
2. 使用脚本输出的测试密钥进行存款
3. 使用相同密钥进行取款

## 预期结果

完成后，您应该能够：
- ✅ 在前端成功存款
- ✅ 看到承诺被正确存储
- ✅ 在取款时找到承诺
- ✅ 生成有效的 ZK 证明（模拟）

## 如果仍然有问题

如果取款仍然失败，我们需要检查：
1. 前端是否连接到正确的网络
2. 合约地址是否正确
3. 事件日志是否正确获取
4. Merkle 树构建是否正确

## 调试技巧

在浏览器控制台中检查：
```javascript
// 检查网络
console.log('Network:', await window.ethereum.request({ method: 'net_version' }));

// 检查合约地址
console.log('Contract address:', PRIVACY_POOL_ADDRESS);

// 检查事件
// （在 WithdrawCard 组件中已有详细日志）
```

---

**下一步**: 运行步骤 1 和 2，然后告诉我结果，我们继续调试。
