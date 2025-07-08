// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./lib/interfaces/IPaymaster.sol";
import "./lib/interfaces/IEntryPoint.sol";
import "./lib/core/UserOperationLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
    address target;
}

contract Paymaster is IPaymaster, Ownable {
    IEntryPoint public immutable entryPoint;
    
    // A mapping to whitelist specific target contracts
    mapping(address => bool) public supportedTargets;

    // Custom errors for gas efficiency
    error UnsupportedTarget();

    event TargetSupportChanged(address indexed target, bool supported);
    event FundsDeposited(address indexed depositor, uint256 amount);

    constructor(address _entryPoint, address _owner) Ownable(_owner) {
        entryPoint = IEntryPoint(_entryPoint);
    }

    /**
     * @dev Sets whether a target contract is supported for gas sponsorship.
     */
    function setSupportedTarget(address target, bool supported) external onlyOwner {
        supportedTargets[target] = supported;
        emit TargetSupportChanged(target, supported);
    }

    /**
     * @dev Deposits funds into the EntryPoint on behalf of this Paymaster.
     */
    function depositToEntryPoint() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit FundsDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Validates a UserOperation to determine if it should be sponsored.
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata packedUserOp,
        bytes32 /*userOpHash*/,
        uint256 /*maxCost*/
    ) external view override returns (bytes memory context, uint256 validationData) {
        UserOperation memory userOp;
        userOp.sender = packedUserOp.sender;
        userOp.nonce = packedUserOp.nonce;
        userOp.initCode = packedUserOp.initCode;
        userOp.callData = packedUserOp.callData;
        (userOp.verificationGasLimit, userOp.callGasLimit) = UserOperationLib.unpackUints(packedUserOp.accountGasLimits);
        userOp.preVerificationGas = packedUserOp.preVerificationGas;
        (userOp.maxPriorityFeePerGas, userOp.maxFeePerGas) = UserOperationLib.unpackUints(packedUserOp.gasFees);
        userOp.paymasterAndData = packedUserOp.paymasterAndData;
        userOp.signature = packedUserOp.signature;
        userOp.target = address(bytes20(packedUserOp.callData[4:24]));

        if (!supportedTargets[userOp.target]) {
            revert UnsupportedTarget();
        }
        // For this simple paymaster, we don't need any context, so we return an empty bytes array.
        // We also don't have any time-based validation, so validationData is 0.
        return (bytes(""), 0);
    }

    /**
     * @dev The function that the EntryPoint calls after the execution to charge the Paymaster.
     */
    function postOp(
        PostOpMode /*mode*/, 
        bytes calldata /*context*/, 
        uint256 /*actualGasCost*/,
        uint256 /*actualUserOpFeePerGas*/
    ) external view override {
        // In this simple implementation, we don't need to do anything here.
        // The EntryPoint will automatically deduct the gas cost from our deposit.
        // Adding view call to prevent empty block warning
        entryPoint.balanceOf(address(this));
    }
}