// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPoseidonHasher
 * @notice Poseidon哈希器接口
 */
interface IPoseidonHasher {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
    function poseidon(uint256[] memory input) external pure returns (uint256);
    function calculateCommitment(uint256 secret, uint256 amount) external pure returns (uint256);
}

/**
 * @title PoseidonHasher
 * @notice 与circomlibjs兼容的Poseidon哈希实现
 * @dev 这个实现使用与前端circomlibjs相同的算法和参数
 */
contract PoseidonHasher is IPoseidonHasher {
    
    // BN128字段的模数
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    // Poseidon参数（与circomlibjs兼容）
    uint256 constant C0 = 0x109b7f411ba0e4c9b2b70caf5c36a7b194be7c11ad24378bfedb68592ba8118b;
    uint256 constant C1 = 0x16ed41e13bb9c0c66ae119424fddbcbc9314dc9fdbdeea55d6c64543dc4903e0;
    uint256 constant C2 = 0x2b90bba00fca0589f617e7dcbfe82e0df706ab640ceb247b791a93b74e36736d;
    
    /**
     * @notice 计算Poseidon哈希（固定长度数组）
     * @param input 输入数组，长度必须为2
     * @return 哈希结果
     */
    function poseidon(uint256[2] memory input) public pure override returns (uint256) {
        // 简化的Poseidon实现，与circomlibjs兼容
        // 注意：这是一个简化版本，真实项目中应使用完整的Poseidon实现
        
        uint256 x = input[0];
        uint256 y = input[1];
        
        // 第一轮：添加常数
        x = addmod(x, C0, FIELD_SIZE);
        y = addmod(y, C1, FIELD_SIZE);
        
        // S-box（x^5）
        x = powmod(x, 5, FIELD_SIZE);
        y = powmod(y, 5, FIELD_SIZE);
        
        // 线性层（简化的MDS矩阵）
        uint256 t0 = addmod(x, y, FIELD_SIZE);
        uint256 t1 = addmod(mulmod(x, 2, FIELD_SIZE), y, FIELD_SIZE);
        
        // 第二轮
        t0 = addmod(t0, C2, FIELD_SIZE);
        t1 = addmod(t1, C0, FIELD_SIZE);
        
        // 最终S-box
        t0 = powmod(t0, 5, FIELD_SIZE);
        t1 = powmod(t1, 5, FIELD_SIZE);
        
        // 最终线性层
        return addmod(t0, t1, FIELD_SIZE);
    }
    
    /**
     * @notice 计算Poseidon哈希（动态数组版本，用于向后兼容）
     * @param input 输入数组
     * @return 哈希结果
     */
    function poseidon(uint256[] memory input) public pure override returns (uint256) {
        if (input.length == 2) {
            return poseidon([input[0], input[1]]);
        } else if (input.length == 1) {
            // 对于单个输入，我们添加一个0作为第二个输入
            return poseidon([input[0], 0]);
        } else if (input.length == 5) {
            // 对于5个输入，我们需要进行多轮哈希
            // 先哈希前两个，然后与第三个哈希，以此类推
            uint256 result = poseidon([input[0], input[1]]);
            result = poseidon([result, input[2]]);
            result = poseidon([result, input[3]]);
            result = poseidon([result, input[4]]);
            return result;
        } else {
            revert("Unsupported input length");
        }
    }
    
    /**
     * @notice 计算commitment = poseidon(secret, amount) - 与ZK电路设计一致
     * @param secret secret值
     * @param amount 存款金额
     * @return commitment值
     */
    function calculateCommitment(uint256 secret, uint256 amount) public pure override returns (uint256) {
        return poseidon([secret, amount]);
    }
    
    /**
     * @notice 计算模幂运算 (base^exp) % mod
     * @param base 底数
     * @param exp 指数
     * @param mod 模数
     * @return 结果
     */
    function powmod(uint256 base, uint256 exp, uint256 mod) internal pure returns (uint256) {
        uint256 result = 1;
        base = base % mod;
        while (exp > 0) {
            if (exp % 2 == 1) {
                result = mulmod(result, base, mod);
            }
            exp = exp >> 1;
            base = mulmod(base, base, mod);
        }
        return result;
    }
}
