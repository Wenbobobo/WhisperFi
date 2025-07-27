// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IVerifier } from "./IVerifier.sol";
import { IPoseidonHasher } from "./PoseidonHasher.sol";
import { SNARK_SCALAR_FIELD } from "./lib/Globals.sol";

/**
 * @title PrivacyPool
 * @notice A privacy pool for anonymous transactions using ZK-SNARKs.
 * @dev This contract manages deposits, withdrawals, and the Merkle tree of commitments.
 * It now integrates all Merkle tree logic directly and relies on an external PoseidonHasher contract.
 */
contract PrivacyPool is Ownable {
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;
    uint256 private constant TREE_DEPTH = 16;
    bytes32 private constant ZERO_VALUE = bytes32(uint256(keccak256("PrivacyPool-Zero")) % SNARK_SCALAR_FIELD);

    IVerifier public immutable verifier;
    IPoseidonHasher public immutable poseidonHasher;

    // --- Merkle Tree State ---
    bytes32 public merkleRoot;
    uint256 public nextLeafIndex;
    mapping(bytes32 => bool) public nullifiers;
    mapping(bytes32 => bool) public rootHistory;
    bytes32[TREE_DEPTH] private zeros;
    bytes32[TREE_DEPTH] private filledSubTrees;

    event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address to, bytes32 nullifier);

    constructor(address _verifier, address _poseidonHasher, address _initialOwner) Ownable(_initialOwner) {
        verifier = IVerifier(_verifier);
        poseidonHasher = IPoseidonHasher(_poseidonHasher);

        // Initialize Merkle Tree
        bytes32 currentZero = ZERO_VALUE;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = currentZero;
            filledSubTrees[i] = currentZero;
            currentZero = _hashLeftRight(currentZero, currentZero);
        }
        merkleRoot = currentZero;
        rootHistory[merkleRoot] = true;
    }

    function deposit(bytes32 _commitment) external payable {
        require(msg.value == DEPOSIT_AMOUNT, "Invalid deposit amount");
        _insertLeaf(_commitment);
        emit Deposit(_commitment, uint32(nextLeafIndex - 1), block.timestamp);
    }

    function withdraw(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _proofRoot,
        bytes32 _nullifier,
        address payable _recipient,
        uint256 _fee, // Fee for the relayer
        address payable _relayer // Relayer address
    ) external {
        require(rootHistory[_proofRoot], "Invalid Merkle root");
        require(!nullifiers[_nullifier], "Nullifier has been used");

        // The public signals for the withdrawal circuit are hashed into a single public input.
        // We must reconstruct the public hash input exactly as the circuit does.
        uint256 publicInputsHash = _calculatePublicInputsHash(_proofRoot, _nullifier, _recipient, _fee, _relayer);

        uint256[1] memory pubSignals = [publicInputsHash];

        require(verifier.verifyProof(_pA, _pB, _pC, pubSignals), "Invalid proof");

        nullifiers[_nullifier] = true;
        
        // Transfer funds
        _recipient.transfer(DEPOSIT_AMOUNT - _fee);
        if (_fee > 0) {
            _relayer.transfer(_fee);
        }

        emit Withdrawal(_recipient, _nullifier);
    }

    function _insertLeaf(bytes32 _leaf) internal {
        require(nextLeafIndex < (2 ** TREE_DEPTH), "Merkle tree is full");

        uint256 currentIndex = nextLeafIndex;
        bytes32 currentLevelHash = _leaf;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) { // Left node
                filledSubTrees[i] = currentLevelHash;
                currentLevelHash = _hashLeftRight(currentLevelHash, zeros[i]);
            } else { // Right node
                currentLevelHash = _hashLeftRight(filledSubTrees[i], currentLevelHash);
            }
            currentIndex /= 2;
        }

        merkleRoot = currentLevelHash;
        rootHistory[merkleRoot] = true;
        nextLeafIndex++;
    }

    function _hashLeftRight(bytes32 _left, bytes32 _right) internal view returns (bytes32) {
        uint256[] memory inputs = new uint256[](2);
        inputs[0] = uint256(_left);
        inputs[1] = uint256(_right);
        return bytes32(poseidonHasher.poseidon(inputs));
    }

    function calculateCommitment(uint256 _nullifier, uint256 _secret) public view returns (bytes32) {
        uint256[] memory inputs = new uint256[](2);
        inputs[0] = _nullifier;
        inputs[1] = _secret;
        return bytes32(poseidonHasher.poseidon(inputs));
    }

    function _calculatePublicInputsHash(
        bytes32 _root,
        bytes32 _nullifier,
        address _recipient,
        uint256 _fee,
        address _relayer
    ) internal view returns (uint256) {
        // This hash must match the one computed in the circuit.
        uint256[] memory inputs = new uint256[](5);
        inputs[0] = uint256(_root);
        inputs[1] = uint256(_nullifier);
        inputs[2] = uint256(uint160(address(_recipient)));
        inputs[3] = _fee;
        inputs[4] = uint256(uint160(address(_relayer)));
        return poseidonHasher.poseidon(inputs);
    }
}
