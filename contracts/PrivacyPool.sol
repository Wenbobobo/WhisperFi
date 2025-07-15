// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./lib/Commitments.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./IExecutor.sol";
import "./IVerifier.sol";

contract PrivacyPool is OwnableUpgradeable, Commitments {
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;
    address public verifier;

    event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address to, bytes32 nullifier);
    event Trade(bytes32 nullifier, bytes32 newCommitment, bytes32 tradeDataHash);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _verifier, address _initialOwner) public initializer {
        initializeCommitments();
        __Ownable_init(_initialOwner);
        verifier = _verifier;
    }

    function deposit(bytes32 _commitment) external payable {
        require(msg.value == DEPOSIT_AMOUNT, "Invalid deposit amount");
        bytes32[] memory commitments = new bytes32[](1);
        commitments[0] = _commitment;
        insertLeaves(commitments);
        emit Deposit(_commitment, uint32(nextLeafIndex - 1), block.timestamp);
    }

    function withdraw(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _proofRoot, 
        bytes32 _nullifier, 
        address _recipient, 
        uint256 _amount
    ) external {
        require(merkleRoot == _proofRoot, "Invalid Merkle root");
        require(!nullifiers[0][_nullifier], "Nullifier has been used");
        
        bytes32 leaf = keccak256(abi.encodePacked(_recipient, _amount, _nullifier));
        uint[1] memory pubSignals = [uint(leaf)];

        require(IVerifier(verifier).verifyProof(_pA, _pB, _pC, pubSignals), "Invalid proof");

        nullifiers[0][_nullifier] = true;
        payable(_recipient).transfer(_amount);
        emit Withdrawal(_recipient, _nullifier);
    }

    // ... (trade function remains the same for now)
}
