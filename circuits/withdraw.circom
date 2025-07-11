pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input enabled;

    component hashers[levels];
    
    // 使用信号数组来避免重复赋值
    signal hashes[levels + 1];
    
    // 初始化第一个哈希值为叶子节点
    hashes[0] <== leaf;
    
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        
        // 根据路径索引确定哈希顺序
        // pathIndices[i] = 0 表示当前节点是左子节点，sibling在右边
        // pathIndices[i] = 1 表示当前节点是右子节点，sibling在左边
        hashers[i].inputs[0] <== hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
        hashers[i].inputs[1] <== pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);
        
        hashes[i + 1] <== hashers[i].out;
    }
    
    // 验证最终哈希是否等于根节点
    component rootCheck = ForceEqualIfEnabled();
    rootCheck.enabled <== enabled;
    rootCheck.in[0] <== hashes[levels];
    rootCheck.in[1] <== root;
}

template ForceEqualIfEnabled() {
    signal input enabled;
    signal input in[2];
    
    component eq = IsEqual();
    eq.in[0] <== in[0];
    eq.in[1] <== in[1];
    
    // 如果enabled为1，则强制相等
    enabled * (1 - eq.out) === 0;
}

template IsEqual() {
    signal input in[2];
    signal output out;
    
    component eq = IsZero();
    eq.in <== in[0] - in[1];
    out <== eq.out;
}

template IsZero() {
    signal input in;
    signal output out;
    
    signal inv;
    inv <-- in != 0 ? 1 / in : 0;
    out <== -in * inv + 1;
    in * out === 0;
}

// 主要的Withdraw模板
template Withdraw(levels) {
    // 私有输入
    signal input secret;
    signal input amount;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 公共输入
    signal input merkleRoot;
    signal input nullifier;
    
    // 公共输出 - 这些是验证者可以看到的
    signal output root;
    signal output nullifierHash;

    // 1. 从secret和amount计算commitment
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== amount;
    signal commitment <== commitmentHasher.out;

    // 2. 验证commitment是否在Merkle树中
    component merkleProof = MerkleTreeChecker(levels);
    merkleProof.leaf <== commitment;
    merkleProof.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }
    merkleProof.enabled <== 1;

    // 3. 从secret计算nullifier
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== secret;
    signal calculatedNullifier <== nullifierHasher.out;

    // 4. 约束公共nullifier必须等于从secret计算出的nullifier
    nullifier === calculatedNullifier;
    
    // 5. 输出公共信号
    root <== merkleRoot;
    nullifierHash <== calculatedNullifier;
}

// 定义主组件 - 使用深度为20的Merkle树
component main = Withdraw(20);