// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./TestAccount.sol";
import "./lib/interfaces/IEntryPoint.sol";

/**
 * @title A debug version of the factory for creating TestAccount instances.
 * @dev Uses the CREATE2 opcode to deploy accounts to a predictable address with debug functions.
 */
contract TestAccountFactoryDebug {
    IEntryPoint public immutable entryPoint;

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    /**
     * @dev Debug function to get detailed CREATE2 calculation info
     */
    function getAddressDebug(address _owner, uint256 _salt) public view returns (
        bytes32 initCodeHash,
        bytes32 salt,
        address factory,
        bytes32 finalHash,
        address predictedAddress
    ) {
        salt = bytes32(_salt);
        factory = address(this);
        
        // Calculate the complete init code (creation code + constructor args)
        bytes memory initCode = abi.encodePacked(
            type(TestAccount).creationCode,
            abi.encode(entryPoint, _owner)
        );
        initCodeHash = keccak256(initCode);
        
        // Calculate finalHash
        finalHash = keccak256(abi.encodePacked(
            bytes1(0xff),
            factory,
            salt,
            initCodeHash
        ));
        
        predictedAddress = address(uint160(uint256(finalHash)));
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
            type(TestAccount).creationCode,
            abi.encode(entryPoint, _owner)
        );
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
     * @dev Deploys a new TestAccount and returns debug info.
     */
    function createAccountDebug(address _owner, uint256 _salt) public returns (
        address predictedAddress,
        address actualAddress,
        bool matches
    ) {
        predictedAddress = getAccountAddress(_owner, _salt);
        bytes32 salt = bytes32(_salt);
        TestAccount account = new TestAccount{salt: salt}(entryPoint, _owner);
        actualAddress = address(account);
        matches = (actualAddress == predictedAddress);
        
        emit AccountCreated(actualAddress, _owner, _salt);
        return (predictedAddress, actualAddress, matches);
    }

    /**
     * @dev Deploys a new TestAccount.
     * @param _owner The owner of the new account.
     * @param _salt A unique value to ensure a unique address.
     * @return The newly created TestAccount instance.
     */
    function createAccount(address _owner, uint256 _salt) public returns (address) {
        address predictedAddress = getAccountAddress(_owner, _salt);
        bytes32 salt = bytes32(_salt);
        TestAccount account = new TestAccount{salt: salt}(entryPoint, _owner);
        require(address(account) == predictedAddress, "CREATE2_PREDICTION_MISMATCH");
        emit AccountCreated(address(account), _owner, _salt);
        return address(account);
    }
}