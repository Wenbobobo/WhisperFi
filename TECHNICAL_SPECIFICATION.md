# 技术规格与开发蓝图 v1.1

**文档目的**: 本文档是项目的“单一事实来源 (Single Source of Truth)”，旨在取代所有旧的、分散的计划和跟踪文件。它将为所有现有和未来的贡献者，提供一个关于项目战略、架构、功能规格、接口定义和开发状态的、清晰、详实且唯一的指南。

---

## 第一部分：战略与架构

- **核心定位**: 为专业交易者和注重隐私的用户，提供一个在功能上超越竞品、在体验上达到业界顶级的、更安全、更易用、更强大的下一代隐私 DeFi 协议。
- **核心优势**: 独特的 **“强隐私核心 (ZK) + 极致体验层 (AA)”** 混合架构。
- **架构详述**: 请参阅 `docs/STRATEGIC_ANALYSIS.md`。

---

## 第二部分：核心功能技术规格

### 2.1 功能模块：匿名资金池 (Privacy Pool)

#### 2.1.1 子功能：存款 (Deposit)
- **用户故事**: 作为用户，我希望在点击存款时，系统能为我生成一个安全的、唯一的凭证，并用它来存入固定数额的资金，以便我之后可以使用这个凭证来取回或使用我的资金。
- **预期功能**:
  1. 前端不设输入框，点击“存款”按钮即开始流程。
  2. 前端调用 `generateNote()` 生成一个格式为 `private-defi-{secret}-{nullifier}-v1` 的凭证。
  3. 前端使用 `generateCommitment(secret, amount)` 计算出 `commitment` 哈希。
  4. 前端调用合约的 `deposit` 函数，参数为 `commitment` 和 0.1 ETH 的 `msg.value`。
  5. 交易成功后，前端必须以醒目的、强制用户交互的方式，展示完整的凭证字符串，并强烈提示用户备份。
- **技术实现备忘**: `(待本次统一测试后填充)`
- **对应接口**:
  - `Crypto.ts`: `generateNote(): string`, `parseNote(string): {secret, nullifier}`, `generateCommitment(string, string): string`
  - `PrivacyPool.sol`: `deposit(bytes32 _commitment) payable`
- **历史遗留问题与防范**: 
  - **问题点**: 前端 `commitment` 计算逻辑与 ZK 电路不一致。
  - **防范措施**: `crypto.test.ts` 单元测试套件，使用预计算的、确定的值来验证 `generateCommitment` 的输出，确保其与电路的 `Poseidon(secret, amount)` 逻辑绝对一致。

#### 2.1.2 子功能：取款 (Withdraw)
- **用户故事**: 作为用户，我希望提供我之前保存的凭证，系统能够验证它的有效性，并允许我将资金取回到我指定的地址。
- **预期功能**:
  1. 用户在输入框中粘贴完整的凭证字符串。
  2. 点击“生成证明���后，前端解析凭证，获取 `secret` 和 `nullifier`。
  3. 前端获取所有 `Deposit` 事件，在本地构建一个与链上状态一致的 Merkle 树。
  4. 前端在树中找到对应的 `commitment`，并生成 Merkle 路径。
  5. 前端使用 `snarkjs`，将 `secret`, `amount`, `pathElements` 等所有数据输入 ZK 电路，生成证明。
  6. 证明生成后，用户点击“取款”按钮，前端将证明和公共输入提交给合约。
- **技术实现备忘**: `(待本次统一测试后填充)`
- **对应接口**:
  - `Crypto.ts`: `generateNullifierHash(string): string`
  - `PrivacyPool.sol`: `withdraw(uint[2] a, uint[2][2] b, uint[2] c, bytes32 root, bytes32 nullifierHash, address recipient, uint256 amount)`
  - `ZK Circuit (withdraw.circom)`: `secret`, `amount`, `pathElements`, `pathIndices`, `merkleRoot`, `nullifier`
- **历史遗留问题与防范**: 
  - **问题点 1**: 前端 Merkle 树的哈希逻辑（如 `fixed-merkle-tree` 的默认行为）与链上及电路的 `Poseidon` 哈希不一致。
  - **防范措施 1**: 在前端构建 `MerkleTree` 实例时，必须显式传入一个与链上 `PoseidonMerkleTree.sol` 完全一致的、固定顺序的 `(left, right) => poseidon([left, right])` 哈希函数。
  - **问题点 2**: ZK 电路所需的 `.wasm` 和 `.zkey` 文件未能正确加载到前端��
  - **防范措施 2**: 将这些 ZK 资源文件放置在 `frontend/public/zk` 目录下，并通过自动化测试确保它们在证明生成时是可访问的。

### 2.2 功能模块：账户抽象 (Account Abstraction)

#### 2.2.1 子功能：智能账户工厂
- **用户故事**: 作为开发者/高级用户，我希望能通过一个工厂合约，以可预测的地址，为用户创建智能合约钱包。
- **预期功能**:
  1. 工厂合约可以根据 `owner` 和 `salt`，预先计算出智能账户的地址。
  2. 工厂合约可以根据 `owner` 和 `salt`，部署一个新的智能账户。
- **技术实现备忘**: `(待本次统一测试后填充)`
- **对应接口**:
  - `SmartAccountFactory.sol`: `getAccountAddress(address _owner, uint256 _salt) returns (address)`, `createAccount(address _owner, uint256 _salt) returns (address)`
- **历史遗留问题与防范**: 
  - **问题点**: `CREATE2` 地址的链上计算逻辑与链下 `ethers.getCreate2Address` 的计算逻辑存在细微差别，导致地址预测不匹配。
  - **防范措施**: `SmartAccountFactory.test.ts` 必须包含一个测试用例，该用例同时使用合约的 `getAccountAddress` 函数和 JS 的 `getCreate2Address` 函数来计算地址，并断言两者相等，确保链上和链下的一致性。

--- 

## 第三部分：开发计划与��态

### **“可信根基”计划 (进行中)**

**目标**: 彻底重构测试策略，统一加密标准，确保现有功能的绝对可靠。

- **[ ] 1. 统一加密标准 (进行中)**
  - [x] **分析 ZK 电路**: 已确认 `withdraw.circom` 的哈希逻辑。
  - [x] **重构 `crypto.ts`**: 已确保前端加密逻辑与电路一致。
  - [x] **重构 `PoseidonMerkleTree.sol`**: 已确保链上 Merkle 树哈希逻辑与电路一致。
  - [ ] **编写 `crypto.test.ts`**: 为前端加密工具编写全面的单元测试。

- **[ ] 2. 建立自动化测试流程 (待办)**
  - [ ] **清理测试目录**: 移除所有临时的、用于 hack 调试的测试文件。
  - [ ] **创建自动化部署脚本**: 编写一个脚本，在测试前自动部署全新环境，并将地址写入测试配置文件。
  - [ ] **重构集成测试**: 修改 `AA-E2E.test.ts` 等文件，使其从配置文件中读取地址，而不是硬编码。

- **[ ] 3. 修复并验证核心功能 (当前焦点)**
  - [ ] **修复 `crypto.ts` 中的 `poseidon is not defined` 错误**。
  - [ ] **完成一次成功的、端到端的存款和取款流程测试**。

### **“超越者”计划 (待办)**

**目标**: 在“可信根基”之上，构建超越竞品的功能和体验。详情请参阅 **[ROADMAP.md](ROADMAP.md)**。
