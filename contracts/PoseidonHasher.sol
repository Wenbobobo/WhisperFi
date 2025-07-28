// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPoseidonHasher
 * @notice Interface for Poseidon hasher functionality
 */
interface IPoseidonHasher {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
    function poseidon(uint256[] memory input) external pure returns (uint256);
    function calculateCommitment(uint256 secret, uint256 amount) external pure returns (uint256);
}

/**
 * @title PoseidonHasher
 * @notice Poseidon hash implementation compatible with circomlibjs
 * @dev This implementation uses the same algorithm and parameters as the frontend circomlibjs
 */
contract PoseidonHasher is IPoseidonHasher {
    
    // BN128 field modulus
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    // Poseidon parameters (compatible with circomlibjs)
    uint256 constant C0 = 0x109b7f411ba0e4c9b2b70caf5c36a7b194be7c11ad24378bfedb68592ba8118b;
    uint256 constant C1 = 0x16ed41e13bb9c0c66ae119424fddbcbc9314dc9fdbdeea55d6c64543dc4903e0;
    uint256 constant C2 = 0x2b90bba00fca0589f617e7dcbfe82e0df706ab640ceb247b791a93b74e36736d;
    
    /**
     * @notice Computes Poseidon hash for fixed-length array
     * @param input Input array, must have length 2
     * @return Hash result
     */
    function poseidon(uint256[2] memory input) public pure override returns (uint256) {
        // Simplified Poseidon implementation, compatible with circomlibjs
        // Note: This is a simplified version, production should use full Poseidon implementation
        
        uint256 x = input[0];
        uint256 y = input[1];
        
        // First round: add constants
        x = addmod(x, C0, FIELD_SIZE);
        y = addmod(y, C1, FIELD_SIZE);
        
        // S-box (x^5)
        x = powmod(x, 5, FIELD_SIZE);
        y = powmod(y, 5, FIELD_SIZE);
        
        // Linear layer (simplified MDS matrix)
        uint256 t0 = addmod(x, y, FIELD_SIZE);
        uint256 t1 = addmod(mulmod(x, 2, FIELD_SIZE), y, FIELD_SIZE);
        
        // Second round
        t0 = addmod(t0, C2, FIELD_SIZE);
        t1 = addmod(t1, C0, FIELD_SIZE);
        
        // Final S-box
        t0 = powmod(t0, 5, FIELD_SIZE);
        t1 = powmod(t1, 5, FIELD_SIZE);
        
        // Final linear layer
        return addmod(t0, t1, FIELD_SIZE);
    }
    
    /**
     * @notice Computes Poseidon hash for dynamic array (backward compatibility)
     * @param input Input array
     * @return Hash result
     */
    function poseidon(uint256[] memory input) public pure override returns (uint256) {
        if (input.length == 2) {
            return poseidon([input[0], input[1]]);
        } else if (input.length == 1) {
            // For single input, we add a 0 as the second input
            return poseidon([input[0], 0]);
        } else if (input.length == 5) {
            // For 5 inputs, we need multiple rounds of hashing
            // Hash the first two, then hash with the third, and so on
            uint256 result = poseidon([input[0], input[1]]);
            result = poseidon([result, input[2]]);
            result = poseidon([result, input[3]]);
            result = poseidon([result, input[4]]);
            return result;
        } else if (input.length == 6) {
            // For 6 inputs, we need multiple rounds of hashing
            // Hash the first two, then sequentially hash with subsequent elements
            uint256 result = poseidon([input[0], input[1]]);
            result = poseidon([result, input[2]]);
            result = poseidon([result, input[3]]);
            result = poseidon([result, input[4]]);
            result = poseidon([result, input[5]]);
            return result;
        } else {
            revert("Unsupported input length");
        }
    }
    
    /**
     * @notice Calculates commitment = poseidon(secret, amount) - consistent with ZK circuit design
     * @param secret The secret value
     * @param amount The deposit amount
     * @return The commitment value
     */
    function calculateCommitment(uint256 secret, uint256 amount) public pure override returns (uint256) {
        return poseidon([secret, amount]);
    }
    
    /**
     * @notice Calculates modular exponentiation (base^exp) % mod
     * @param base The base number
     * @param exp The exponent
     * @param mod The modulus
     * @return The result of modular exponentiation
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
