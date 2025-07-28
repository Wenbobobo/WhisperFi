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
    event Trade(bytes32 indexed nullifier, bytes32 indexed newCommitment, address target, uint256 tradeAmount);

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
/**
     * @notice Execute a private trade using ZK-SNARK proof
     * @param _pA ZK proof parameter A
     * @param _pB ZK proof parameter B
     * @param _pC ZK proof parameter C
     * @param _merkleRoot Merkle root for proof verification
     * @param _nullifier Nullifier to prevent double-spending
     * @param _newCommitment New commitment to be added to the tree
     * @param _tradeAmount Amount to be traded
     * @param _recipient Recipient address for the trade
     * @param _tradeDataHash Hash of trade data (recipient + tradeAmount)
     * @param _target Target contract for the trade execution
     * @param _callData Call data for the trade execution
     */
    function trade(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _merkleRoot,
        bytes32 _nullifier,
        bytes32 _newCommitment,
        uint256 _tradeAmount,
        address _recipient,
        bytes32 _tradeDataHash,
        address _target,
        bytes calldata _callData
    ) external {
        // --- Checks ---
        _validateTradeInputs(_merkleRoot, _nullifier, _recipient, _tradeAmount, _tradeDataHash);
        
        // --- ZK Proof Verification ---
        _verifyTradeProof(_pA, _pB, _pC, _merkleRoot, _nullifier, _newCommitment, _tradeAmount, _recipient, _tradeDataHash);

        // --- Effects ---
        nullifiers[_nullifier] = true;
        _insertLeaf(_newCommitment);

        // --- Interactions ---
        _executeTradeCall(_target, _callData);

        emit Trade(_nullifier, _newCommitment, _target, _tradeAmount);
    }

    function _validateTradeInputs(
        bytes32 _merkleRoot,
        bytes32 _nullifier,
        address _recipient,
        uint256 _tradeAmount,
        bytes32 _tradeDataHash
    ) internal view {
        require(rootHistory[_merkleRoot], "Invalid Merkle root");
        require(!nullifiers[_nullifier], "Nullifier has been used");
        
        bytes32 expectedHash = _calculateTradeDataHash(_recipient, _tradeAmount);
        require(_tradeDataHash == expectedHash, "Invalid trade data hash");
    }

    function _verifyTradeProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _merkleRoot,
        bytes32 _nullifier,
        bytes32 _newCommitment,
        uint256 _tradeAmount,
        address _recipient,
        bytes32 _tradeDataHash
    ) internal view {
        uint256 publicInputsHash = _buildTradePublicInputsHash(
            _merkleRoot, _nullifier, _newCommitment, _tradeAmount, _recipient, _tradeDataHash
        );
        uint256[1] memory pubSignals = [publicInputsHash];
        require(verifier.verifyProof(_pA, _pB, _pC, pubSignals), "Invalid ZK proof");
    }

    function _buildTradePublicInputsHash(
        bytes32 _merkleRoot,
        bytes32 _nullifier,
        bytes32 _newCommitment,
        uint256 _tradeAmount,
        address _recipient,
        bytes32 _tradeDataHash
    ) internal view returns (uint256) {
        uint256[] memory publicSignals = new uint256[](6);
        publicSignals[0] = uint256(_merkleRoot);
        publicSignals[1] = uint256(_nullifier);
        publicSignals[2] = uint256(_newCommitment);
        publicSignals[3] = _tradeAmount;
        publicSignals[4] = uint256(uint160(_recipient));
        publicSignals[5] = uint256(_tradeDataHash);
        return poseidonHasher.poseidon(publicSignals);
    }

    function _executeTradeCall(address _target, bytes calldata _callData) internal {
        (bool success, bytes memory returnData) = _target.call(_callData);
        if (!success) {
            if (returnData.length > 0) {
                // Decode and propagate the specific error message
                assembly {
                    let returndata_size := mload(returnData)
                    revert(add(32, returnData), returndata_size)
                }
            } else {
                revert("Trade execution failed");
            }
        }
    }

    function _calculateTradeDataHash(address _recipient, uint256 _tradeAmount) internal view returns (bytes32) {
        uint256[] memory inputs = new uint256[](2);
        inputs[0] = uint256(uint160(_recipient));
        inputs[1] = _tradeAmount;
        
        return bytes32(poseidonHasher.poseidon(inputs));
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
