# 🧪 现在就可以测试！

## 当前状态 ✅

根据 `frontend/src/config/contracts.ts` 文件，合约已经部署：

- **PrivacyPool**: `0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE`
- **Verifier**: `0x0B306BF915C4d645ff596e518fAf3F9669b97016`
- **Executor**: `0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1`
- **部署时间**: 2025-07-10T02:01:06.835Z
- **网络**: localhost:8545

## 立即测试步骤

### 1. 确保 Hardhat 网络运行

```bash
# 如果还没运行，启动 Hardhat 网络
cd "d:\zWenbo\AI\Private Defi"
npx hardhat node
```

### 2. 启动前端

```bash
cd "d:\zWenbo\AI\Private Defi\frontend"
npm run dev
```

### 3. 配置 MetaMask

- 网络: `http://localhost:8545`
- 链 ID: `31337`
- 导入 Hardhat 第一个账户
  - 地址: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
  - 私钥: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

### 4. 测试流程

1. 访问 `http://localhost:3000`
2. 连接钱包
3. 在存款页面输入密钥: `test-deposit-123`
4. 点击 "Deposit 0.1 ETH"
5. 切换到取款页面
6. 输入相同密钥: `test-deposit-123`
7. 点击 "Generate Proof"

## 预期结果

### 存款应该：

- ✅ 生成承诺
- ✅ 成功发送交易
- ✅ 显示成功消息

### 取款应该：

- ✅ 找到存款承诺
- ✅ 成功生成证明（模拟）
- ✅ 显示 "Submit Transaction" 按钮

## 如果取款失败

检查浏览器控制台，应该看到详细的调试信息：

```
🔍 Starting proof generation...
📡 Fetching deposit events...
📊 Found X deposit events
🔑 Generating commitment from secret...
Generated commitment: 0x...
🌳 Building Merkle tree...
🔍 Finding commitment in tree...
```

如果看到 "❌ Commitment not found in tree"，那么：

1. 检查是否连接了正确的网络
2. 检查是否使用了正确的密钥
3. 检查合约地址是否正确

## 调试命令

如果需要验证部署状态：

```bash
# 检查合约是否正确部署
cd "d:\zWenbo\AI\Private Defi"
npx hardhat console --network localhost

# 在控制台中运行：
const PrivacyPool = await ethers.getContractAt("PrivacyPool", "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE");
console.log("Contract address:", await PrivacyPool.getAddress());
console.log("Deposit amount:", ethers.formatEther(await PrivacyPool.DEPOSIT_AMOUNT()));
```

---

**现在就可以开始测试了！** 🚀
