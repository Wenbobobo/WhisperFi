// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// Correctly importing MerkleTree from OpenZeppelin
import "@openzeppelin/contracts/utils/structs/MerkleTree.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IExecutor.sol";
import "./IVerifier.sol";

contract PrivacyPool is Ownable {
    using MerkleTree for MerkleTree.Bytes32PushTree;

    uint256 public constant LEVELS = 20;
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;
    bytes32 public root;
    mapping(bytes32 => bool) public nullifiers;
    address public verifier; // This will be the Verifier.sol contract address

    MerkleTree.Bytes32PushTree private tree;

    event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address to, bytes32 nullifier);
    event Trade(bytes32 nullifier, bytes32 newCommitment, bytes32 tradeDataHash);

    constructor(address _verifier, bytes32 _zeroValue, address _initialOwner) Ownable(_initialOwner) {
        verifier = _verifier;
        root = tree.setup(uint8(LEVELS), _zeroValue);
    }

    function deposit(bytes32 _commitment) external payable {
        require(msg.value == DEPOSIT_AMOUNT, "Invalid deposit amount");
        (uint256 index, bytes32 newRoot) = tree.push(_commitment);
        root = newRoot;
        emit Deposit(_commitment, uint32(index), block.timestamp);
    }

    // NOTE: The MerkleProof.verify function does not exist. The logic for verifying a proof against the root
    // is typically done within the ZK circuit itself. The smart contract only needs to ensure that the public
    // inputs used for the proof (like the root) are valid and that the nullifier has not been used.
    function withdraw(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _proofRoot, 
        bytes32 _nullifier, 
        address _recipient, 
        uint256 _amount
    ) external {
        require(_proofRoot == root, "Invalid Merkle root");
        require(!nullifiers[_nullifier], "Nullifier has been used");
        
        bytes32 leaf = keccak256(abi.encodePacked(_recipient, _amount, _nullifier));
        uint[1] memory pubSignals = [uint(leaf)]; // Simplified for this example

        require(IVerifier(verifier).verifyProof(_pA, _pB, _pC, pubSignals), "Invalid proof");

        nullifiers[_nullifier] = true;
        payable(_recipient).transfer(_amount);
        emit Withdrawal(_recipient, _nullifier);
    }

    function trade(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _proofRoot, 
        bytes32 _nullifier, 
        bytes32 _newCommitment, 
        bytes32 _tradeDataHash, 
        address _executor, 
        address _target, 
        bytes calldata _callData
    ) external {
        require(_proofRoot == root, "Invalid Merkle root");
        require(!nullifiers[_nullifier], "Nullifier has been used");

        uint[1] memory pubSignals = [uint(_tradeDataHash)]; // Simplified for this example

        require(IVerifier(verifier).verifyProof(_pA, _pB, _pC, pubSignals), "Invalid proof");

        nullifiers[_nullifier] = true;
        (uint256 index, bytes32 newRoot) = tree.push(_newCommitment);
        root = newRoot;
        emit Deposit(_newCommitment, uint32(index), block.timestamp);
        IExecutor(_executor).execute(_target, _callData);
        emit Trade(_nullifier, _newCommitment, _tradeDataHash);
    }
}