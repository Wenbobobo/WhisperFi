// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./lib/PoseidonMerkleTree.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IExecutor.sol";
import "./IVerifier.sol";

contract PrivacyPool is Ownable {
    PoseidonMerkleTree public tree;
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;
    mapping(bytes32 => bool) public nullifiers;
    address public verifier;

    event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address to, bytes32 nullifier);
    event Trade(bytes32 nullifier, bytes32 newCommitment, bytes32 tradeDataHash);

    constructor(address _verifier, address _initialOwner) Ownable(_initialOwner) {
        verifier = _verifier;
        tree = new PoseidonMerkleTree();
    }

    function deposit(bytes32 _commitment) external payable {
        require(msg.value == DEPOSIT_AMOUNT, "Invalid deposit amount");
        uint32 index = tree.insert(_commitment);
        emit Deposit(_commitment, index, block.timestamp);
    }

    function getRoot() public view returns (bytes32) {
        return tree.getRoot();
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
        require(_proofRoot == tree.getRoot(), "Invalid Merkle root");
        require(!nullifiers[_nullifier], "Nullifier has been used");
        
        bytes32 leaf = keccak256(abi.encodePacked(_recipient, _amount, _nullifier));
        uint[1] memory pubSignals = [uint(leaf)];

        require(IVerifier(verifier).verifyProof(_pA, _pB, _pC, pubSignals), "Invalid proof");

        nullifiers[_nullifier] = true;
        payable(_recipient).transfer(_amount);
        emit Withdrawal(_recipient, _nullifier);
    }

    // ... (trade function remains the same for now)
}