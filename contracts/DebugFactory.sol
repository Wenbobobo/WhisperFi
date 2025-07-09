// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./TestAccount.sol";
import "./lib/interfaces/IEntryPoint.sol";

/**
 * @title Debug helper for TestAccountFactory
 * @dev Helps debug CREATE2 address calculation issues
 */
contract DebugFactory {
    IEntryPoint public immutable entryPoint;

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    /**
     * @dev Returns the creation code hash for debugging
     */
    function getCreationCodeHash(address _owner) external view returns (bytes32) {
        return keccak256(abi.encodePacked(
            type(TestAccount).creationCode,
            abi.encode(entryPoint, _owner)
        ));
    }

    /**
     * @dev Returns the creation code for debugging
     */
    function getCreationCode() external pure returns (bytes memory) {
        return type(TestAccount).creationCode;
    }

    /**
     * @dev Returns the constructor args for debugging
     */
    function getConstructorArgs(address _owner) external view returns (bytes memory) {
        return abi.encode(entryPoint, _owner);
    }

    /**
     * @dev Test CREATE2 calculation step by step
     */
    function debugCreate2(address _owner, uint256 _salt) external view returns (
        bytes32 creationCodeHash,
        bytes32 salt,
        address factory,
        bytes32 finalHash,
        address predictedAddress
    ) {
        salt = bytes32(_salt);
        factory = address(this);
        
        creationCodeHash = keccak256(abi.encodePacked(
            type(TestAccount).creationCode,
            abi.encode(entryPoint, _owner)
        ));
        
        finalHash = keccak256(abi.encodePacked(
            bytes1(0xff),
            factory,
            salt,
            creationCodeHash
        ));
        
        predictedAddress = address(uint160(uint256(finalHash)));
    }

    /**
     * @dev Actually deploy using CREATE2 for comparison
     */
    function actualDeploy(address _owner, uint256 _salt) external returns (address) {
        bytes32 salt = bytes32(_salt);
        TestAccount account = new TestAccount{salt: salt}(entryPoint, _owner);
        return address(account);
    }
}
