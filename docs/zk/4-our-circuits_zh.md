# ZK知识库：第四部分

## 我们的电路：协议的核心

现在我们对zk-SNARKs背后的理论有了扎实的理解，让我们仔细看看我们为协议设计的具体电路。这些电路是我们系统的核心，它们负责确保用户交易的隐私和安全。

### 1. `deposit.circom`

这是我们协议中最简单的电路。其目的是获取用户的私有票据（由`secret`和`amount`组成）并生成一个公开的`commitment`哈希。然后将此承诺添加到默克尔树中。

**输入：**

- `secret`（私有）：只有用户知道的随机秘密数字。
- `amount`（私有）：存款金额。

**输出：**

- `commitment`（公开）：`secret`和`amount`的哈希值。

**逻辑：**

电路使用Poseidon哈希函数计算承诺：

`commitment = HASH(secret, amount)`

### 2. `withdraw.circom`

该电路用于证明用户有权从隐私池中提取特定金额。它证明用户知道默克尔树中一个有效的、未花费的票据的秘密。

**输入：**

- `secret`（私有）：票据的秘密。
- `amount`（私有）：票据的金额。
- `merklePath`（私有）：用于证明票据包含在默克尔树中的路径。
- `merkleRoot`（公开）：默克尔树的根。
- `nullifier`（公开）：票据的无效符，以防止双重花费。

**逻辑：**

1.  **计算承诺：** 电路根据`secret`和`amount`计算承诺，就像在`deposit`电路中一样。
2.  **验证默克尔证明：** 电路使用`MerkleTreeChecker`模板来验证计算出的承诺是`merkleRoot`的一部分。
3.  **计算无效符：** 电路根据`secret`计算`nullifier`。
4.  **约束无效符：** 电路约束公共`nullifier`必须等于计算出的无效符。

### 3. `trade.circom`

这是我们协议中最复杂的电路。它用于证明用户有权花费隐私池中的一张票据来执行交易。它与`withdraw`电路类似，但有几个关键区别：

-   **它消耗一张旧票据并创建一张新的找零票据。**
-   **它授权一笔特定的交易。**

**输入：**

- `oldSecret`（私有）：被花费票据的秘密。
- `oldAmount`（私有）：被花费票据的金额。
- `merklePath`（私有）：用于证明旧票据包含在默克尔树中的路径。
- `newSecret`（私有）：新找零票据的秘密。
- `newAmount`（私有）：新找零票据的金额。
- `merkleRoot`（公开）：默克尔树的根。
- `nullifier`（公开）：旧票据的无效符。
- `newCommitment`（公开）：新找零票据的承诺。
- `tradeAmount`（公开）：用于交易的金额。
- `recipient`（公开）：接收交易金额的公共地址。
- `tradeDataHash`（公开）：交易详情的哈希。

**逻��：**

1.  **验证旧票据：** 电路以与`withdraw`电路相同的方式验证旧票据。
2.  **验证无效符：** 电路验证旧票据的无效符。
3.  **验证新承诺：** 电路计算新找零票据的承诺，并约束它必须等于公共的`newCommitment`。
4.  **验证价值守恒：** 电路约束`newAmount`和`tradeAmount`的总和必须等于`oldAmount`。
5.  **约束交易数据哈希：** 电路约束`tradeDatahash`必须是`recipient`和`tradeAmount`的哈希。这确保了证明只对这笔特定的交易有效。
