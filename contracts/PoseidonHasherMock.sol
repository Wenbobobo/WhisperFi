// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoseidonHasherMock
 * @notice 测试专用的 Poseidon 哈希实现
 * @dev 这是一个简化的 Poseidon 哈希实现，仅用于测试环境
 *      在生产环境中应使用真正的预编译合约
 */
contract PoseidonHasherMock {
    /**
     * @notice 计算 Poseidon 哈希
     * @param input 输入数组
     * @return result 哈希结果
     * @dev 这是一个简化的实现，使用 keccak256 作为基础，
     *      然后进行一些变换来模拟 Poseidon 的行为
     */
    function poseidon(uint256[] memory input) public pure returns (uint256 result) {
        require(input.length > 0, "Input array cannot be empty");
        require(input.length <= 16, "Input array too large");
        
        // 对于测试环境，我们使用一个确定性的哈希函数
        // 这不是真正的 Poseidon，但对测试来说足够了
        bytes32 hash = keccak256(abi.encodePacked(input));
        
        // 进行一些变换来模拟 Poseidon 的特性
        // 使用一些质数来增加复杂性
        uint256 temp = uint256(hash);
        unchecked {
            temp = temp ^ (temp >> 128);
            temp = temp * 0x9e3779b97f4a7c15; // 黄金比例的倒数
            temp = temp ^ (temp >> 64);
            temp = temp * 0xc6a4a7935bd1e995; // 另一个大质数
            temp = temp ^ (temp >> 32);
        }
        
        return temp;
    }
}

/**
 * @title IPoseidonHasher
 * @notice Poseidon 哈希器接口
 */
interface IPoseidonHasher {
    function poseidon(uint256[] memory input) external view returns (uint256);
}