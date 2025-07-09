// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./SmartAccount.sol";
import "./lib/interfaces/IEntryPoint.sol";

/**
 * @title A factory for creating SmartAccount instances.
 * @dev Uses the CREATE2 opcode to deploy accounts to a predictable address.
 */
contract SmartAccountFactory {
    IEntryPoint public immutable entryPoint;

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    /**
     * @dev Calculates the address of a new account without deploying it.
     * @param _owner The owner of the new account.
     * @param _salt A unique value to ensure a unique address.
     * @return The predicted address of the new account.
     */
    function getAccountAddress(address _owner, uint256 _salt) public view returns (address) {
        bytes32 salt = bytes32(_salt);
        
        // Calculate the complete init code (creation code + constructor args)
        bytes memory initCode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(entryPoint, _owner)
        );
        // 修复：用 initCode 而非未声明的 bytecode
        bytes32 initCodeHash = keccak256(initCode);
        
        // Calculate the CREATE2 address
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            initCodeHash
        )))));
    }

    /**
     * @dev Deploys a new SmartAccount.
     * @param _owner The owner of the new account.
     * @param _salt A unique value to ensure a unique address.
     * @return The newly created SmartAccount instance.
     */
    function createAccount(address _owner, uint256 _salt) public returns (address) {
        address predictedAddress = getAccountAddress(_owner, _salt);
        bytes32 salt = bytes32(_salt);
        SmartAccount account = new SmartAccount{salt: salt}(entryPoint, _owner);
        require(address(account) == predictedAddress, "CREATE2_PREDICTION_MISMATCH");
        emit AccountCreated(address(account), _owner, _salt);
        return address(account);
    }
}
