# 规划文档：实现生产级的匿名取款功能

## 1. 目标

本阶段的核心目标是实现一个功能完备、安全可靠、状态同步精确且用户体验良好的匿名取款功能。这需要我们将前端的密码学操作与后端的链上状态进行完美结合。

---

## 2. 核心挑战与架构梳理

当前遇到的核心问题 `Secret note not found in deposits`，揭示了在“链下计算”与“链上状态”之间存在着一个或多个不匹配。为了解决这个问题，我们需要将取款流程分解为以下几个关键的、必须精确同步的架构组件：

| 组件                   | 位置              | 职责                                                                                                              | 关键技术/挑战                                                                                                                  |
| :--------------------- | :---------------- | :---------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **1. Secret / Note**   | 用户              | 用户输入的原始秘密（例如，`my-secret-note-123`）。                                                                | 必须确保用户输入的格式和编码与存款时完全一致。                                                                                 |
| **2. Commitment 计算** | 前端 (JS/TS)      | 根据用户输入的 `secret`，计算出 `commitment` 哈希值。                                                             | **(高度嫌疑)** 哈希算法（`ethers.keccak256` vs `ethers.encodeBytes32String`）、编码方式（`toUtf8Bytes`）必须与存款时完全一致。 |
| **3. 事件日志获取**    | 前端 (Viem/Wagmi) | 从区块链节点获取所有历史 `Deposit` 事件。                                                                         | 确保 ABI 正确，`eventName` 匹配，`fromBlock` 设置为 0 以获取所有历史记录。                                                     |
| **4. Merkle 树构建**   | 前端 (JS/TS)      | 使用从事件中提取的 `commitment` 列表，在前端构建一个 Merkle 树。                                                  | 树的参数（深度、哈希函数、零值）必须与 `PrivacyPool.sol` 合约中的设置完全一致。                                                |
| **5. Merkle 路径生成** | 前端 (JS/TS)      | 在前端构建的树中，找到与用户 `commitment` 匹配的叶子节点，并生成其 Merkle 路径和索引。                            | `findIndex` 必须能成功匹配，这依赖于第 2 步计算的 `commitment` 是否正确。                                                      |
| **6. ZK 电路输入准备** | 前端 (JS/TS)      | 将 `root`, `nullifier`, `recipient`, `amount`, `pathElements`, `pathIndices` 等所有数据准备成 ZK 电路所需的格式。 | `nullifier` 的生成必须是确定性的；`root` 必须与链上当前的 `root` 一致。                                                        |
| **7. ZK 证明生成**     | 前端 (snarkjs)    | 调用 `groth16.fullProve` 生成 ZK 证明。                                                                           | `.wasm` 和 `.zkey` 文件必须与我们编译 `withdraw.circom` 时使用的版本完全匹配。                                                 |
| **8. 交易提交**        | 前端 (Wagmi)      | 将生成的 `proof` 和 `publicSignals` 传递给 `PrivacyPool.sol` 的 `withdraw` 函数。                                 | `proof` 的 `a, b, c` 组件的格式和顺序必须与合约函数的期望完全匹配。                                                            |

---

## 3. 待实现的具体技术步骤

基于以上梳理，我们将按以下顺序，一步步地、系统性地实现并验证取款功能：

1.  **统一 Commitment 生成逻辑**: 创建一个可复用的辅助函数 `generateCommitment(secret: string)`，并在 `DepositCard` 和 `WithdrawCard` 中**同时使用它**，以确保哈希计算的绝对一致性。

2.  **实现健壮的 Merkle 树同步器**: 创建一个新的 React Hook `useMerkleTree()`。这个 Hook 将负责：

    - 获取所有 `Deposit` 事件。
    - 构建并缓存 Merkle 树。
    - 返回树的实例、叶子列表和当前的 `root`。
    - 提供一个 `getPath(commitment)` 方法，用于生成 Merkle 证明。

3.  **重构 `WithdrawCard`**:

    - 使用 `useMerkleTree` Hook 来获取树和路径。
    - 在 `generateProof` 函数中，专注于准备 ZK 电路的输入和调用 `snarkjs`。
    - 添加更多的调试输出，让我们可以在控制台中清晰地看到每一步的输入和输出（`secret`, `commitment`, `leafIndex`, `root` 等）。

4.  **编写专门的 `withdraw` 电路测试**: 在 `test` 目录下，创建一个新的测试文件，专门用于在 Hardhat 环境中，模拟前端的完整证明生成和验证流程，以提前发现任何不匹配。

5.  **端到端流程验证**: 在完成以上所有步骤后，再进行最终的前端交互测试。
