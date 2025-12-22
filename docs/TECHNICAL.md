# WhisperFi 技术规范

**完整技术文档** - 合并了技术规范、代码审查、性能基准

---

## 系统架构

```
Layer 1: ZK-SNARKs
├── Groth16 证明系统
├── Circom 电路 (circuits/withdraw.circom)
└── SnarkJS 证明生成

Layer 2: Account Abstraction (ERC-4337)
├── EntryPoint.sol
├── SmartAccountFactory.sol
└── Paymaster.sol

Layer 3: Privacy Pool
├── PrivacyPool.sol (主合约)
├── Poseidon Hash (跨域一致性)
└── Merkle Tree (depth 16)

Layer 4: Frontend
├── Next.js 14 + TypeScript
├── Wagmi + Viem
└── Playwright
```

---

## 核心合约

### PrivacyPool.sol

```solidity
contract PrivacyPool {
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;
    uint256 public constant MERKLE_TREE_DEPTH = 16;
    
    mapping(bytes32 => bool) public rootHistory;
    mapping(bytes32 => bool) public nullifierHistory;
    
    function deposit(bytes32 _commitment) external payable;
    function withdraw(...) external;
}
```

**关键功能**:
- 固定金额存款（0.1 ETH）
- Merkle 树深度 16
- Poseidon Hash
- Groth16 ZK 证明验证

### EntryPoint.sol (ERC-4337)

**功能**:
- UserOperation 验证和执行
- Gas 赞助
- 批量交易

---

## ZK 电路

### withdraw.circom

```circom
template Withdraw(levels) {
    signal input secret;
    signal input amount;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    signal output commitment;
    signal output nullifier;
    signal output root;
}
```

**参数**:
- levels: 16 (Merkle 树深度)
- 约束数: ~1000
- 证明时间: ~2-5 秒

---

## Poseidon Hash 一致性

**关键**: JavaScript ↔ Solidity ↔ Circom 必须一致

```typescript
// 统一字节码生成
const poseidonContract = await buildPoseidon();
const bytecode = poseidonContract.createCode(2);
```

**重要性**: 🔴 核心基础 - 所有 commitment/nullifier 依赖此一致性

---

## 性能基准

### Merkle 树重建

| Commitments | 时间 | 吞吐量 |
|------------|------|--------|
| 100 | ~0.1s | 1000/s |
| 1,000 | ~1s | 1000/s |
| 10,000 | ~10s | 1000/s |

### ZK 证明生成

- Witness 计算: ~1s
- 证明生成: ~2-5s
- 验证: ~0.1s (链上)

### Gas 消耗

| 操作 | Gas | ETH (@20 gwei) |
|------|-----|----------------|
| Deposit | ~150k | ~0.003 |
| Withdraw | ~300k | ~0.006 |
| Proof Verify | ~250k | ~0.005 |

---

## 安全考虑

### 已知风险

1. **Frontrunning**: 使用 Flashbots 缓解
2. **Nullifier 泄露**: 链下生成，链上验证
3. **Merkle Root 操纵**: 历史 root 验证

### 缓解措施

- MEV 保护（Flashbots）
- 事件监听和缓存
- 多重验证

---

## 代码审查要点

- [ ] Solidity: 无溢出、重入、访问控制
- [ ] ZK 电路: 约束完整性
- [ ] 前端: XSS、注入攻击
- [ ] 测试覆盖: 关键路径 100%

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2025-12-22
