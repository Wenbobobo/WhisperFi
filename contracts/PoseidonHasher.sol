// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


contract PoseidonHasher {
    function poseidon(uint256[2] memory input) public view returns (uint256 result) {
        assembly {
            let x := mload(add(input, 0x20))
            let y := mload(add(input, 0x40))
            mstore(0x00, x)
            mstore(0x20, y)
            let success := staticcall(gas(), 9, 0x00, 0x40, 0x00, 0x20)
            if iszero(success) {
                revert(0, 0)
            }
            result := mload(0x00)
        }
    }

    function poseidon(bytes32[2] memory input) public view returns (uint256 result) {
        assembly {
            let x := mload(add(input, 0x20))
            let y := mload(add(input, 0x40))
            mstore(0x00, x)
            mstore(0x20, y)
            let success := staticcall(gas(), 9, 0x00, 0x40, 0x00, 0x20)
            if iszero(success) {
                revert(0, 0)
            }
            result := mload(0x00)
        }
    }
}

interface IPoseidonHasher {
    function poseidon(uint256[2] memory input) external view returns (uint256);
    function poseidon(bytes32[2] memory input) external view returns (uint256);
}
