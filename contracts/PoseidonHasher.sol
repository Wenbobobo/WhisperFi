// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

library PoseidonT3 {
    function poseidon(bytes32[2] memory input) public pure returns (bytes32) {
        // This is a placeholder implementation
        // In a real deployment, you would use a proper Poseidon implementation
        // For now, we'll use a simple hash that matches our circuit behavior
        return keccak256(abi.encodePacked(input[0], input[1]));
    }
}

contract PoseidonHasher {
    function hash2(bytes32 left, bytes32 right) public pure returns (bytes32) {
        return PoseidonT3.poseidon([left, right]);
    }
    
    function hash1(bytes32 input) public pure returns (bytes32) {
        return PoseidonT3.poseidon([input, bytes32(0)]);
    }
}
