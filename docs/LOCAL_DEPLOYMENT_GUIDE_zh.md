# 本地开发环境部署指南

本文档旨在提供一个清晰、可重复的流程，用于快速搭建和恢复项目的本地开发与测试环境。

---

## 先决条件

- 已安装 Node.js 和 npm。
- 已安装 Hardhat: `npm install -g hardhat`。
- 已克隆本仓库。

---

## 部署流程

当您重启电脑或关闭了 Hardhat 本地节点后，需要按照以下步骤来恢复一个功能完备的测试环境。

### **第一步：启动本地 Hardhat 节点**

这是我们的本地模拟区块链。**此终端窗口需要保持运行。**

```bash
npx hardhat node
```

启动后，您会看到 20 个预先填充了 10000 ETH 的测试账户及其私钥。我们通常使用第一个账户 (`Account #0`) 作为部署者和测试钱包。

### **第二步：部署合约并自动配置前端**

打开**一个新的终端窗口**，运行我们的部署脚本。这个脚本会将所有合约部署到您刚刚启动的本地节点上，并**自动更新前端所需的合约地址配置文件**。

```bash
npx hardhat run scripts/deploy.js --network localhost
```

您无需再手动复制任何地址。脚本会自动处理所有配置。

### **第三步：启动前端开发服务器**

在**第三个终端窗口**中，进入 `frontend` 目录并启动开发服务器。

```bash
cd frontend
npm run dev
```

### **第四步：配置 MetaMask**

如果您是首次设置，或 MetaMask 中的网络信息已丢失，请按照以下步骤操作：

1.  **添加 Hardhat 网络**:
    *   **Network Name**: `Hardhat Local`
    *   **RPC URL**: `http://127.0.0.1:8545`
    *   **Chain ID**: `31337`
    *   **Currency Symbol**: `ETH`

2.  **导入测试账户**:
    *   切换到 `Hardhat Local` 网络。
    *   使用 `Account #0` 的私钥 (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`) 导入一个新账户。

---

现在，您的本地开发环境已完全恢复。您可以在浏览器中打开 `http://localhost:3000`，连接您刚刚导入的测试账户，并与 dApp 进行交互。
