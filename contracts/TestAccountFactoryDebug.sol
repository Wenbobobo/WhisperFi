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
        
        // Calculate initCodeHash exactly as in getAddress
        initCodeHash = keccak256(abi.encodePacked(
            type(TestAccount).creationCode,
            abi.encode(entryPoint, _owner)
        ));
        
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
    function getAddress(address _owner, uint256 _salt) public view returns (address) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(
            type(TestAccount).creationCode,
            abi.encode(entryPoint, _owner)
        ));
        
        bytes32 finalHash = keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            bytes32(_salt),
            initCodeHash
        ));
        
        return address(uint160(uint256(finalHash)));
    }

    /**
     * @dev Deploys a new TestAccount and returns debug info.
     */
    function createAccountDebug(address _owner, uint256 _salt) public returns (
        address predictedAddress,
        address actualAddress,
        bool matches
    ) {
        predictedAddress = getAddress(_owner, _salt);
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
        address predictedAddress = getAddress(_owner, _salt);
        bytes32 salt = bytes32(_salt);
        TestAccount account = new TestAccount{salt: salt}(entryPoint, _owner);
        require(address(account) == predictedAddress, "CREATE2_PREDICTION_MISMATCH");
        emit AccountCreated(address(account), _owner, _salt);
        return address(account);
    }
}