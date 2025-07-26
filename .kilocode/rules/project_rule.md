# project_rule.md

## 指导原则

## 第一部分：通用原则与 Git 工作流

### 1.1 核心开发哲学

- **优雅且具有时间性价比**: 这是我们最重要的指导原则。在做出任何技术决策时，我们都应首先扪心自问：这个方案是否足够优雅？它是否是解决当前问题的、最具性价比的途径？我们拒绝“过度设计”，也鄙弃临时的“hack”修复。
- **测试先行，验证驱动**: 在没有为关键组件建立起坚实的、自动化的单元和集成测试之前，任何功能都不能被认为是“已完成”。我们不依赖手动的、偶然的测试，而是相信自动化测试建立的“可信根基”。
- **谦逊沟通，持续学习**: 我们承认项目的复杂性，并鼓励坦诚、高效的沟通。在遇到难题时，我们优先选择寻求帮助和深入研究（例如，通读成熟的开源实现），而不是陷入“闭门造车”的困境。

### 1.2 Git 工作流规范

- **分支模型**: 我们采用 `main` (主分支) + `develop` (开发分支) + `feature/` (功能分支) 的模型。
  - `main`: 只用于发布稳定版本，所有提交都必须来自 `develop` 分支的合并，并打上版本标签。
  - `develop`: 作为日常开发的主干，集成所有已完成的功能。
  - `feature/`: 所有新功能的开发，都必须从 `develop` 分支创建，并以 `feature/` 为前缀（例如，`feature/relayer-trade-api`）。
- **提交信息 (Commit Message)**: 我们遵循 **[Conventional Commits](https://www.conventionalcommits.org/)** 规范。这有助于我们自动化地生成 `CHANGELOG`，并使提交历史清晰可读。
  - **格式**: `<type>(<scope>): <subject>`
  - **示例**: `feat(frontend): add withdraw functionality to UI`
  - **常用 `type`**: `feat` (新功能), `fix` (bug 修复), `docs` (文档), `style` (代码风格), `refactor` (重构), `test` (测试), `chore` (构建或辅助工具变动)。
- **Pull Request (PR)**:
  - 所有 `feature/` 分支都合入 `develop` 分支时，必须通过 Pull Request 进行。
  - PR 的描述中，应清晰地说明该功能解决了什么问题，以及是如何实现的。
  - 在合并之前，必须通过所有的自动化测试 (CI)。

---

## 第二部分：Solidity 智能合约规范

### 2.1 代码风格

- **格式化**: 我们遵循新版标准的 **[Solidity Style Guide]**。所有合约都必须使用 4 个空格进行缩进。
- **命名**:
  - `contract` 和 `library` 使用 `PascalCase` (例如，`PrivacyPool`, `PoseidonT3`)。
  - `function` 和 `variable` 使用 `camelCase` (例如，`deposit`, `merkleRoot`)。
  - `constant` 使用 `UPPER_CASE_WITH_UNDERSCORES` (例如，`DEPOSIT_AMOUNT`)。
  - 私有或内部函数/变量，以下划线 `_` 开头 (例如，`_insertLeaves`)。
- **注释 (NatSpec)**: 所有 `public` 和 `external` 函数，都必须包含完整的 **NatSpec** 注释，清晰地说明其功能、参数和返回值。这对于自动生成文档和提高代码可读性至关重要。
  - **示例**:
    ```solidity
    /**
     * @notice Deploys a new SmartAccount.
     * @param _owner The owner of the new account.
     * @param _salt A unique value to ensure a unique address.
     * @return The newly created SmartAccount instance.
     */
    function createAccount(address _owner, uint256 _salt) public returns (SmartAccount) { ... }
    ```

### 2.2 最佳实践

- **安全第一**:
  - **检查-生效-交互 (Checks-Effects-Interactions) 模式**: 严格遵循此模式，以防止重入攻击。先进行所有条件检查（`require`），然后更新状态变量，最后再与外部合约交互（如 `transfer`）。
  - **使用 `Ownable`**: 对于有权限控制的函数，优先使用 OpenZeppelin 的 `Ownable` 合约，而不是手写权限逻辑。
  - **自定义错误**: 优先使用自定义错误（`error UnsupportedTarget();`）而不是 `require` 字符串，这可以极大地节省 Gas。
- **接口与继承**:
  - **面向接口编程**: 在与外部合约交互时，优先使用其 `interface`，而不是直接使用其具体实现。这使得我们的代码更具模块化和可测试性。
  - **谨慎使用继承**: 我们借鉴了 Railgun 的 `Commitments.sol`，但要时刻注意继承带来的复杂性。对于纯粹的工具函数，优先使用 `library`。
- **Gas 优化**:
  - **避免不必要的存储**: 尽量使用 `memory` 或 `calldata` 来处理函数内部的临时数据。
  - **瞬态存储 (Cancun)**: 我们的项目已配置为使用 `cancun` EVM 版本。在适当的场景下（例如，在一次交易中需要临时存储，但不需要永久保存的数据），可以考虑使用 `TSTORE` 和 `TLOAD` 操作码来进一步节省 Gas。
- **版本锁定**: 所有的 `pragma solidity` 都应锁定到一个具体的版本（例如，`^0.8.28`），以避免因编译器版本更新而引入的意外行为。

---

## 第三部分：TypeScript / 前端规范

### 3.1 代码风格

- **格式化**: 我们自动格式化所有前端代码。请确保您的编辑器已安装插件，并在保存时自动格式化。
- **命名**:
  - **组件**: 使用 `PascalCase` (例如，`DepositCard`)。
  - **函数/变量**: 使用 `camelCase` (例如，`generateProof`, `merkleRoot`)。
  - **类型/接口**: 使用 `PascalCase` (例如，`PackedUserOperation`)。
- **文件结构**:
  - **组件**: 所有可复用的 React 组件，都应放置在 `frontend/src/components` 目录下。
  - **工具函数**: 可复用的工具函数（如加密逻辑），应放置在 `frontend/src/utils` 目录下。
  - **配置**: 项目的配置文件（如合约地址），应放置在 `frontend/src/config` 目录下。

### 3.2 最佳实践

- **类型安全**:
  - **杜绝 `any`**: 我们应尽力避免使用 `any` 类型。对于不确定的类型，优先使用 `unknown` 并进行类型收窄。对于第三方库返回的、没有明确类型的数据，应为其创建 `interface` 或 `type` 定义。
  - **接口定义**: 为所有复杂的数据结构（特别是 `UserOperation`）创建清晰的 `interface` 定义。
- **状态管理**:
  - **优先使用 `useState`**: 对于组件内部的简单状态，优先使用 `useState`。
  - **轻量级全局状态**: 对于需要跨组件共享的、简单的全局状态，我们使用 **Zustand**。它避免了 Redux 的模板代码和复杂性。
- **区块链交互**:
  - **使用 `wagmi`**: 我们使用 `wagmi` 的 React Hooks (`useAccount`, `useWriteContract` 等) 来处理所有与钱包和合约的交互。这极大地简化了代码，并提供了自动的状态管理（如 `isPending`, `isSuccess`）。
  - **配置文件驱动**: **严禁**在组件中硬编码合约地址。所有地址都必须从 `frontend/src/config/contracts.ts` 中导入。这个文件由部署脚本自动生成，确保了前端与链上状态的一致性。
- **用户体验**:
  - **清晰的状态反馈**: 必须为所有异步操作（如交易、证明生成）提供清晰的加载状态（`loading...`）和结果反馈（成功/失败消息）。
  - **错误处理**: 必须捕获并向用户展示有意义的错误信息，而不是让应用崩溃或静默失败。

---

## 第四部分：测试规范

### 4.1 测试哲学

- **自动化是第一原则**: 我们不接受任何需要手动验证的测试。所有测试都必须是自动化的，并且可以在 CI/CD 环境中运行。
- **分层测试**: 我们采用**单元测试 -> 集成测试 -> 端到端测试**的金字塔模型。我们为最基础、最核心的组件（如 `crypto.ts`）编写最详尽的单元测试，并为完整的用户流程编写少而精的端到端测试。
- **测试必须是可靠的**: 我们必须消除测试中的所有不确定性。这意味着：
  - **隔离的环境**: 每个测试都应该在一个全新的、干净的部署环境中运行。我们的 `test/environment.ts` 脚本是实现这一点的关键。
  - **确定的输入**: 避免在测试中使用完全随机的输入。对于需要随机性的地方，使用一个固定的种子，或者使用预先计算好的、有代表性的数据集。

### 4.2 测试实践

- **单元测试**:
  - **合约**: 每个 `public` 和 `external` 函数，都应该至少有一个对应的测试用例。对于有复杂逻辑的函数，应测试其边界情况和失败情况。
  - **前端工具**: 对于像 `crypto.ts` 这样核心的、纯粹的逻辑库，其测试覆盖率应尽可能接近 100%。
- **集成测试**:
  - **目的**: 验证我们自己编写的、多个组件之间的交互是否正确（例如，`PrivacyPool` 是否能正确调用 `Verifier`）。
  - **实现**: `test/zk-proof-generation.test.ts` 是我们最重要的集成测试，它验证了从前端加密逻辑到 ZK 电路证明生成的完整流程。
- **端到端 (E2E) 测试**:
  - **目的**: 模拟真实的用户场景，验证整个 dApp 的流程是否顺畅。
  - **实现**: `test/AA-E2E.test.ts` 验证了我们最复杂的 AA 流程。我们计划引入 **Playwright**，以实现对前端 UI 的、真正的、自动化的端到端测试。
