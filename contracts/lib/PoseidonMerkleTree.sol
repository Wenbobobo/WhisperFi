// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Poseidon.sol";

contract PoseidonMerkleTree {
    uint32 public constant LEVELS = 20;
    bytes32[LEVELS] public filledSubtrees;
    uint32 public nextIndex;

    constructor() {
        for (uint32 i = 0; i < LEVELS; i++) {
            filledSubtrees[i] = 0;
        }
    }

    function _hash(bytes32 _left, bytes32 _right) internal pure returns (bytes32) {
        return PoseidonT3.poseidon([_left, _right]);
    }

    function insert(bytes32 _leaf) public returns (uint32) {
        uint32 index = nextIndex;
        require(index < 2**LEVELS, "Merkle tree is full");

        bytes32 current = _leaf;
        for (uint32 i = 0; i < LEVELS; i++) {
            if (filledSubtrees[i] == 0) {
                filledSubtrees[i] = current;
                break;
            }
            current = _hash(filledSubtrees[i], current);
            filledSubtrees[i] = 0;
        }
        nextIndex = index + 1;
        return index;
    }

    function getRoot() public view returns (bytes32) {
        bytes32 currentRoot = 0;
        for (uint32 i = 0; i < LEVELS; i++) {
            if (filledSubtrees[i] != 0) {
                if (currentRoot == 0) {
                    currentRoot = filledSubtrees[i];
                } else {
                    currentRoot = _hash(filledSubtrees[i], currentRoot);
                }
            }
        }
        return currentRoot;
    }
}
