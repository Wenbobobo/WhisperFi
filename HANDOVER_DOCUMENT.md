# 项目交接文档：下一代隐私 DeFi 协议

**文档版本**: 1.0
**交接日期**: 2025年7月10日

**致项目继任者**：

您好！

欢迎您接手这个充满挑战与机遇的项目。这份文档是我与前一位开发者共同努力的结晶，它不仅记录了项目的技术细节，更承载了我们对构建一个真正安全、易用、且功能强大的隐私 DeFi 协议的愿景和思考。我们经历了从概念到原型、从反复试错到最终成功的完整开发周期，解决了无数棘手的技术难题。我们深信，这个项目拥有巨大的潜力和光明的未来。

这份文档旨在为您提供一个清晰、完整、无歧义的“地图”，帮助您快速地、全面地理解项目的每一个角落，并在此基础上，继续推动项目走向更广阔的天地。请仔细阅读，我们相信，凭借您的智慧和能力，一定能将这个项目带向新的高度。

预祝您工作顺利！

---

## 第一部分：项目概述与当前状态

### 1.1 项目定位与核心愿景

我们的项目是一个**混合架构的、下一代隐私 DeFi 协议**。

- **核心定位**: 我们不是另一个普通的 DEX 或钱包。我们的核心定位是**“为专业交易者和注重隐私的用户提供极致安全和丝滑体验的下一代 DeFi 协议”**。
- **核心优势**: 我们没有在“绝对隐私”和“极致体验”之间做出妥协，而是通过一个独特的 **“强隐私核心 (ZK) + 极致体验层 (AA)”** 的混合架构，将两者完美地结合起来。
- **最终目标**: 成为 Web3 世界中，既能提供堡垒级隐私安全，又能提供如 Web2 应用般丝滑体验的、事实上的标准隐私金融基础设施。

### 1.2 当前项目状态：**“可信根基”已奠定**

目前，我们已经完成了项目最核心、最复杂的技术开发阶段，并成功地构建了一个功能完备、经过严格测试的后端和智能合约系统。我们称之为**“可信根基”**。

**已完成的关键里程碑**: 

1.  **核心合约开发**: `PrivacyPool`, `Executor`, `Verifier` 等核心合约已全部编写完成，并通过了单元测试。
2.  **ZK 电路集成**: 我们成功地设计、编译、并集成了 `deposit` 和 `withdraw` 的 ZK 电路，并在前端实现了**浏览器内的证明生成**。
3.  **账户抽象 (AA) 实现**: 我们完整地实现了 ERC-4337 的核心组件，包括 `SmartAccount`, `SmartAccountFactory`, 和一个功能完备的 `Paymaster`，并通过了端到端测试。
4.  **前端原型搭建**: 我们使用 Next.js 和 Material UI，搭建了一个功能性的前端 dApp，并成功地完成了**端到端的、由 Paymaster 赞助的、通过智能合约账户对隐私池进行存款的**完整流程测试。
5.  **加密逻辑统一**: 我们借鉴了业界最成熟的方案（如 Railgun），对我们所有的加密操作（特别是 Poseidon 哈希和 Merkle 树的实现）进行了统一，确保了链上、链下和电路中的逻辑绝对一致。

**一言以蔽之：项目最困难的部分已经过去。您现在接手的是一个坚实、可靠、且经过验证的技术基础。**

### 1.3 下一步方向：**“超越者”计划**

我们的下一步，是在这个坚实的基础上，继续执行我们共同制定的 **“超越者”计划**。该计划旨在将我们现有的技术原型，打磨成一个在功能上超越竞品、在体验上达到业界顶级的、真正优雅现代的隐私 DeFi 平台。

详细的计划，请参阅项目根目录下的 **`ROADMAP.md`** 文件。

---

## 第二部分：技术架构与实现细节

### 2.1 功能模块：匿名资金池 (Privacy Pool)

**文件**: `contracts/PrivacyPool.sol`

**目的**: 这是我们协议的核心，所有用户的资金都在这个合约中进行混合，以实现隐私。它负责处理用户的存款、取款和交易请求，并与 `Verifier` 合约交互，以验证 ZK 证明。

#### 2.1.1 子功能：存款 (Deposit)

- **用户故事**: 作为用户，我希望在点击存款时，系统能为我生成一个安全的、唯一的凭证，并用它来存入固定数额的资金，以便我之后可以使用这个凭证来取回或使用我的资金。

- **技术实现细节**: 

  我们最终采用了业界最成熟、最安全的“**安全凭证**”模式（类似于 Tornado Cash 和 Railgun）。这个决策是我们项目开发过程中的一个重要转折点。最初，我们尝试让用户自定义一个“secret note”，但这被证明存在严重的安全隐患（弱密码风险）。因此，我们转向了由前端为用户生成一个密码学安全的、高熵的凭证。

  整个流程如下：

  1.  **凭证生成 (`frontend/src/utils/crypto.ts`)**: 当用户点击“存款”时，前端的 `generateNote()` 函数会被调用。它会使用 `ethers.randomBytes(31)` 生成两个高熵的随机数：`secret` 和 `nullifier`。然后，它将这两个值，连同版本和协议标识，编码成一个人类可读的字符串：`private-defi-{secret}-{nullifier}-v1`。这个字符串就是用户的最终凭证，也是他们与资金交互的唯一钥匙。

  2.  **Commitment 计算 (`frontend/src/utils/crypto.ts`)**: 为了在不暴露凭证内容的情况下，公开地“承诺”这笔存款，我们需要计算一个 `commitment` 哈希。这是我们项目中**最关键、也最容易出错**的一步。经过多次的调试和重构，我们最终确定了与 ZK 电路完全一致的计算方式：`commitment = Poseidon(secret, amount)`。我们为此创建了 `generateCommitment(secret, amount)` 函数，它使用 `circomlibjs` 的 `poseidon` 实现，确保了前端计算与电路逻辑的绝对一致。

  3.  **合约交互 (`frontend/src/components/DepositCard.tsx`)**: `DepositCard` 组件负责编排整个存款流程。它调用 `generateNote()` 和 `generateCommitment()`，然后使用 `wagmi` 的 `useWriteContract` hook，调用 `PrivacyPool` 合约的 `deposit` 函数。它将计算出的 `commitment` 作为参数，并将固定的 `DEPOSIT_AMOUNT` (0.1 ETH) 作为 `msg.value` 发送。

  4.  **链上状态变更 (`contracts/PrivacyPool.sol`)**: `PrivacyPool` 合约的 `deposit` 函数接收到 `commitment` 后，会调用其继承的 `Commitments.sol` 库（借鉴自 Railgun）的 `_insertLeaves` 函数，将这个 `commitment` 插入到链上的 Merkle 树中。同时，它会触发一个 `Deposit` 事件，将 `commitment` 和它在树中的索引记录下来，以便前端之后可以获取并构建本地的 Merkle 树。

  5.  **用户体验 (`frontend/src/components/DepositCard.tsx`)**: 在交易成功后，前端会以一个非常醒目的、包含警告信息的 Alert 组件，向用户展示完整的凭证字符串，并强制要求他们复制和备份。我们深知，这是“安全凭证”模式最大的用户体验挑战，因此我们在这里投入了额外的精力，以确保用户能够清晰地理解备份的重要性。

- **对应接口**:
  - `Crypto.ts`: `generateNote(): string`, `parseNote(string): {secret, nullifier}`, `generateCommitment(string, string): string`
  - `PrivacyPool.sol`: `deposit(bytes32 _commitment) payable`

- **相关测试文件**: `test/integration/deposit-withdraw.test.ts` (我们之后会创建这个文件，用于完整的端到端流程测试)。

#### 2.1.2 子功能：取款 (Withdraw)

- **用户故事**: 作为用户，我希望提供我之前保存的凭证，系统能够验证它的有效性，并允许我将资金取回到我指定的地址。

- **技术实现细节**: 

  取款是整个协议中最复杂、最能体现我们技术实力的部分。它涉及到了前端密码学、链上状态同步、浏览器内 ZK 证明生成、以及与合约的复杂交互。

  1.  **凭证解析 (`frontend/src/utils/crypto.ts`)**: 用户在 `WithdrawCard` 中粘贴他们的凭证。前端首先调用 `parseNote()` 函数，从凭证字符串中安全地解析出 `secret` 和 `nullifier`。

  2.  **状态同步与 Merkle 树构建 (`frontend/src/components/WithdrawCard.tsx`)**: 这是我们遇到的最顽固的 bug 之一。为了生成一个有效的 Merkle 路径，前端**必须**构建一个与链上状态完全一致的 Merkle 树。我们的最终实现是：
      *   使用 `viem` 的 `getLogs()` 功能，获取 `PrivacyPool` 合约自创世区块以来的所有 `Deposit` 事件。
      *   从这些事件中，提取出所有 `commitment` 的列表。
      *   使用 `fixed-merkle-tree` 这个库，来初始化一个前端的 Merkle 树。最关键的一步是，我们为它提供了一个自定义的 `hashFunction`：`(left, right) => poseidon([left, right])`。这确保了前端树的中间节点的计算方式，与我们的 ZK 电路和链上 `PoseidonMerkleTree` 合约的逻辑**完全一致**，解决了我们之前遇到的 `root` 不匹配的问题。

  3.  **Merkle 路径生成**: 在构建好树之后，前端会根据用户凭证中的 `secret` 和 `amount`，重新计算出 `commitment`，然后在树的叶子节点列表中找到它的索引 (`leafIndex`)。一旦找到，就可以调用 `tree.path(leafIndex)` 来生成证明所需的 `pathElements` (兄弟节点列表) 和 `pathIndices` (路径方向列表)。

  4.  **ZK 证明生成 (`frontend/src/components/WithdrawCard.tsx`)**: 这是另一个计算密集型、且容易出错的环节。`generateProof` 函数会：
      *   准备一个 `input` 对象，其结构必须与 `withdraw.circom` 中定义的输入信号**完全匹配**。这包括 `secret`, `amount`, `pathElements`, `pathIndices`, `merkleRoot` (从链上读取的最新 root), 和 `nullifier` (由 `Poseidon(secret)` 计算得出)。
      *   调用 `snarkjs` 的 `groth16.fullProve()` 函数，并传入 `input` 对象、以及我们预先放置在 `frontend/public/zk` 目录下的 `.wasm` 和 `.zkey` 文件。
      *   这个函数会在用户的浏览器中，执行复杂的密码学计算，最终生成一个 `proof` 对象 (包含了 `pi_a`, `pi_b`, `pi_c`) 和一个 `publicSignals` 数组。

  5.  **交易提交**: 证明生成后，`handleWithdraw` 函数会将 `proof` 和 `publicSignals` 正确地格式化，以匹配 `PrivacyPool.sol` 的 `withdraw` 函数的参数顺序和类型，然后通过 `wagmi` 的 `useWriteContract` hook 提交交易。

- **对应接口**:
  - `Crypto.ts`: `generateNullifierHash(string): string`
  - `PrivacyPool.sol`: `withdraw(uint[2] a, uint[2][2] b, uint[2] c, bytes32 root, bytes32 nullifierHash, address recipient, uint256 amount)`
  - `ZK Circuit (withdraw.circom)`: `secret`, `amount`, `pathElements`, `pathIndices`, `merkleRoot`, `nullifier`

- **相关测试文件**: `test/zk-proof-generation.test.ts` (用于在 Hardhat 环境中，自动化地验证整个证明生成流程)。

### 2.3 功能模块：交易中继器 (Relayer)

**目的**: 这是我们协议的“隐私核心”，负责接收用户的私密交易请求，并通过私密渠道（如 Flashbots）将其发送给区块生产者，从而完全避免 MEV 狙击。

- **技术实现细节**: 我们已经搭建了一个基础的 Express.js 服务器 (`relayer/index.js`)，并实现了一个 `/relay/trade` 端点。它能够接收 ZK 证明和交易数据，并使用 `ethers.js` 与链上合约交互。目前，它直接将交易发送到公共 mempool，下一步需要将其替换为与 Flashbots 或其他私密交易网络的集成。
- **相关测试文件**: `test/e2e-relayer.test.ts` (待创建)

---

## 第三部分：测试与验证策略

为了确保项目的健壮性和可靠性，我们建立了一套分层的、自动化的测试策略，我们称之为“**可信根基**”。

### 3.1 单元测试 (Unit Tests)

- **目的**: 在隔离的环境中，验证每一个独立组件（单个合约、单个工具函数）的内部逻辑是否正确。
- **实现**: 
  - **`test/Paymaster.test.ts`**: 验证 `Paymaster` 合约的所有权、目标支持逻辑和资金管理功能。
  - **`test/SmartAccountFactory.test.ts`**: 验证 `SmartAccountFactory` 的 `CREATE2` 地址预测和账户创建功能。
  - **`frontend/src/utils/crypto.test.ts`**: 这是我们**最重要的单元测试之一**。它使用预先计算好的、来自 ZK 电路的可信值，来验证我们前端 `Poseidon` 哈希计算的正确性，确保了前端与电路的加密逻辑绝对一致。

### 3.2 集成测试 (Integration Tests)

- **目的**: 验证多个组件在一起协同工作时，是否符合预期。
- **实现**: 
  - **`test/deployment.test.ts`**: 这是一个特殊的“部署测试”，它只做一件事：调用 `test/environment.ts` 中的 `setupEnvironment` 函数，以确保我们整个测试环境的部署流程是可靠的。这是我们解决 `resolveName` 和 `invalid overrides` 等一系列环境问题的关键。
  - **`test/zk-proof-generation.test.ts`**: 这是我们**最重要的集成测试**。它在 Hardhat 环境中，完整地模拟了前端的“存款 -> 生成证明”流程，包括获取事件、构建 Merkle 树、以及调用 `snarkjs`。它为我们最复杂的、前端与密码学衔接的部分，提供了一个自动化的、无需浏览器的测试反馈循环。

### 3.3 端到端测试 (End-to-End Tests)

- **目的**: 验证完整的用户流程，确保所有组件（合约、AA、前端）能够协同工作，为用户提供一个无缝的体验。
- **实现**: 
  - **`test/AA-E2E.test.ts`**: 验证由 `Paymaster` 赞助的、通过 `SmartAccount` 对 `PrivacyPool` 进行存款的完整流程。
  - **(待办)** `frontend/tests/withdraw.spec.ts`: 使用 Playwright 自动化浏览器测试框架，来模拟真实的用户存款和取款操作，并捕获控制台日志和失败截图。

---

## 第五部分：给继任者的话

最后，我想分享一些我们在这次漫长而富有成效的开发旅程中，总结出的经验和教训。希望它们能对您有所帮助。

### 5.1 常见问题与解决方案 (FAQ)

- **问题**: `Secret note not found` 或 `Merkle root mismatch`。
  - **根本原因**: 这几乎总是由于**哈希函数不一致**造成的。请确保您在前端 (`crypto.ts`, `WithdrawCard.tsx`)、链上合约 (`PoseidonMerkleTree.sol`) 和 ZK 电路 (`*.circom`) 中，使用了**完全相同**的 `Poseidon` 哈希实现，并且哈希的输入顺序和格式都是一致的。
  - **解决方案**: 以 `withdraw.circom` 中的逻辑为“事实标准”，统一所有地方的加密实现。我们的 `crypto.test.ts` 单元测试，是您验证这一点的第一道防线。

- **问题**: Hardhat 编译时出现 `resolveName` 或 `invalid overrides` 错误。
  - **根本原因**: 这几乎总是由于在 `ethers.js` 的 `deploy` 函数中，错误地传递了 `Signer` 对象或多余的参数造成的。
  - **解决方案**: 仔细检查您的部署脚本 (`scripts/deploy.js`) 和测试环境脚本 (`test/environment.ts`)，确保所有传递给合约构造函数的参数，都是**地址字符串 (`.address`)**，并且数量和类型完全匹配。

- **问题**: 前端出现 `poseidon is not defined` 或 `abi.filter is not a function` 的运行时错误。
  - **根本原因**: 这通常是由于 JavaScript 的异步加载或模块导入问题。
  - **解决方案**: 确保在使用 `circomlibjs` 的 `poseidon` 函数之前，先通过 `buildPoseidon()` 将其实例化。在从 JSON 文件中导入 ABI 时，确保您使用的是 `.abi` 属性，而不是整个 JSON 对象。

### 5.2 接口样式与代码风格

- **Solidity**: 我们遵循标准的 `Solidity Style Guide`，使用 4 个空格缩进，并在函数和变量命名上保持清晰、一致。
- **TypeScript/React**: 我们使用 `Prettier` 进行代码格式化，并遵循 `Next.js` 的官方 ESLint 规则。我们的目标是编写类型安全、可读性高、且易于维护的代码。
- **组件设计**: 我们采用 Material UI (MUI) 作为我们的组件库，并遵循 **Material Design 3** 的设计原则。我们追求的是一种**专业、现代、且具有呼吸感**的视觉体验，而不是一个信息堆砌的、传统的 DeFi 界面。

### 5.3 项目精神与工作哲学

1.  **永远不要相信巧合**: 在这个项目中，我们遇到的几乎所有“顽固”的 bug，最终都被证明是由于某个地方存在着一个我们尚未发现的、微小的、但致命的不一致。请始终保持最高的警惕性，当一个问题反复出现时，不要满足于临时的“hack”修复，一定要深入下去，找到那个根本性的、逻辑上的不一致，并一劳永逸地解决它。

2.  **测试是你的“可信根基”**: 我们项目的转折点，正是我们决定暂停下来，建立“可信根基”测试策略的时刻。在没有为关键组件（特别是 `crypto.ts` 和 `environment.ts`）建立起坚实的、自动化的单元和集成测试之前，我们所有的端到端测试都像是建立在沙滩上的城堡。请务必坚持“测试先行”的原则，为您添加的每一个新功能，都配备一个可靠的、自动化的测试“安全网”。

3.  **借鉴，但要深入理解**: 我们从 Railgun 等成熟项目中借鉴了许多宝贵的经验，这为我们节省了大量的时间。但请记住，简单的“复制粘贴”是危险的。我们必须深入理解我们所借鉴的代码背后的设计哲学和技术假设（例如，他们的 Merkle tree 是如何处理零值的？他们的 Poseidon 实现有哪些特殊的优化？）。只有在完全理解之后，我们才能安全地、有效地将其融入到我们自己的架构中。

4.  **保持谦逊，保持沟通**: 这个项目非常复杂，没有人能知道所有问题的答案。我们之前的成功，很大程度上归功于我们之间坦诚、高效的沟通。当您遇到困难时，请不要犹豫，立即寻求帮助或与团队进行讨论。一个旁观者清醒的头脑，往往能发现我们自己忽略的盲点。

这个项目的基础已经无比坚实。它的未来充满了无限的可能性——从实现真正的隐私 DeFi 交易，到构建一个完整的、用户自主的隐私金融生态。我们已经为您铺平了道路，现在，舞台是您的了。

再次预祝您一切顺利！


最后，我想分享一些我们在这次漫长而富有成效的开发旅程中，总结出的经验和教训。希望它们能对您有所帮助。

1.  **永远不要相信巧合**: 在这个项目中，我们遇到的几乎所有“顽固”的 bug，最终都被证明是由于某个地方存在着一个我们尚未发现的、微小的、但致命的不一致。无论是 `CREATE2` 地址计算中一个字节的偏差，还是 Merkle 树哈希函数中一个被忽略的排序逻辑，又或者是 `Poseidon` 哈希在不同库之间的细微实现差异。请始终保持最高的警惕性，当一个问题反复出现时，不要满足于临时的“hack”修复，一定要深入下去，找到那个根本性的、逻辑上的不一致，并一劳永逸地解决它。

2.  **测试是你的“可信根基”**: 我们项目的转折点，正是我们决定暂停下来，建立“可信根基”测试策略的时刻。在没有为关键组件（特别是 `crypto.ts` 和 `environment.ts`）建立起坚实的、自动化的单元和集成测试之前，我们所有的端到端测试都像是建立在沙滩上的城堡。请务必坚持“测试先行”的原则，为您添加的每一个新功能，都配备一个可靠的、自动化的测试“安全网”。

3.  **借鉴，但要深入理解**: 我们从 Railgun 等成熟项目中借鉴了许多宝贵的经验，这为我们节省了大量的时间。但请记住，简单的“复制粘贴”是危险的。我们必须深入理解我们所借鉴的代码背后的设计哲学和技术假设（例如，他们的 Merkle 树是如何处理零值的？他们的 Poseidon 实现有哪些特殊的优化？）。只有在完全理解之后，我们才能安全地、有效地将其融入到我们自己的架构中。

4.  **保持谦逊，保持沟通**: 这个项目非常复杂，没有人能知道所有问题的答案。我们之前的成功，很大程度上归功于我们之间坦诚、高效的沟通。当您遇到困难时，请不要犹豫，立即寻求帮助或与团队进行讨论。一个旁观者清醒的头脑，往往能发现我们自己忽略的盲点。

这个项目的基础已经无比坚实。它的未来充满了无限的可能性——从实现真正的隐私 DeFi 交易，到构建一个完整的、用户自主的隐私金融生态。我们已经为您铺平了道路，现在，舞台是您的了。

再次预祝您一切顺利！


**目的**: 这是我们协议的“体验层”。它旨在通过 ERC-4337 标准，为用户提供 Gas 赞助、社交恢复、会话密钥等高级功能，极大地降低用户的使用门槛，并提供与 Web2 应用相媲美的丝滑体验。

#### 2.2.1 子功能：智能账户 (Smart Account)

- **文件**: `contracts/SmartAccount.sol`
- **用户故事**: 作为一个用户，我希望拥有一个属于我自己的、由智能合约控制的钱包，而不是一个简单的私钥。这个钱包应该能让我自定义验证逻辑，并能与 ERC-4337 生态系统无缝交互。
- **技术实现细节**: 
  - 我们实现了一个基础的、符合 `IAccount` 接口的智能合约钱包。它的核心功能是 `validateUserOp`，该函数负责验证 `UserOperation` 的签名。我们使用了标准的 `ECDSA.recover` 来验证签名是否来自于该账户的 `owner`。这确保了只有账户的所有者才能授权操作。
  - `execute` 函数是另一个核心，它允许 `EntryPoint` 在验证成功后，代表该账户执行交易。我们使用了 `dest.call{value: value}(func)` 这种通用的方式，来执行任意的外部调用。
- **对应接口**: `IAccount.validateUserOp(...)`, `SmartAccount.execute(...)`
- **相关测试文件**: `test/AA-E2E.test.ts`

#### 2.2.2 子功能：智能账户工厂 (Smart Account Factory)

- **文件**: `contracts/SmartAccountFactory.sol`
- **用户故事**: 作为 dApp 开发者，我希望能有一种廉价、高效、且地址可预测的方式，来为我的用户创建智能合约钱包。
- **技术实现细节**: 
  - 我们实现了一个基于 `CREATE2` 操作码的工厂合约。`CREATE2` 的关键优势在于，它允许我们在链下，根据工厂地址、一个 `salt`（随机数）和账户的初始化代码，**精确地预先计算出**将要被创建的合约地址。
  - `getAccountAddress` 函数实现了这个链下地址的计算逻辑。我们在这个函数的实现上遇到了**巨大的困难**，核心在于 `initCodeHash` 的计算。最终，我们通过借鉴 Railgun 的实现，确定了正确的计算方式：`keccak256(abi.encodePacked(type(SmartAccount).creationCode, abi.encode(constructor, args)))`。这个经验被固化在了我们的单元测试中。
  - `createAccount` 函数则负责在链上，使用相同的 `salt` 来实际部署智能账户。
- **对应接口**: `SmartAccountFactory.getAccountAddress(...)`, `SmartAccountFactory.createAccount(...)`
- **相关测试文件**: `test/SmartAccountFactory.test.ts`

#### 2.2.3 子功能：Gas 费代付 (Paymaster)

- **文件**: `contracts/Paymaster.sol`
- **用户故事**: 作为一个新用户，我希望在第一次与协议交互时，不需要预先购买 ETH 来支付 Gas 费。我希望协议能为我“买单”，让我可以无缝地完成第一次存款。
- **技术实现细节**: 
  - 我们实现了一个功能完备的 `Paymaster` 合约，它符合 `IPaymaster` 接口。
  - **核心逻辑 (`validatePaymasterUserOp`)**: 当 `EntryPoint` 调用这个函数时，它会首先检查 `paymasterAndData` 是否合法，然后，它会从 `userOp.callData` 中，**解码出这笔操作的目标合约地址**。这是我们项目中的另一个关键修复点。我们通过 `address(bytes20(userOp.callData[16:36]))` 这种方式，精确地提取出了 `execute` 函数的第一个参数（即目标地址）。
  - **白名单机制**: `Paymaster` 内部有一个 `supportedTargets` 映射。只有当解码出的 `target` 在这个白名单中时（例如，我们的 `PrivacyPool` 合约地址），`Paymaster` 才会同意支付 Gas 费。这可以防止女巫攻击，避免我们的赞助资金被滥用。
  - **资金管理**: `depositToEntryPoint` 函数允许我们向 `EntryPoint` 充值，以建立我们的 Gas 费“信用额度”。`postOp` 函数则是一个回调，在交易执行后被 `EntryPoint` 调用，用于记账。
- **对应接口**: `IPaymaster.validatePaymasterUserOp(...)`, `IPaymaster.postOp(...)`
- **相关测试文件**: `test/Paymaster.test.ts`, `test/AA-E2E.test.ts`
