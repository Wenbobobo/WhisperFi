// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./lib/interfaces/IPaymaster.sol";
import { IEntryPoint } from "./lib/interfaces/IEntryPoint.sol";
import "./lib/core/UserOperationLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Paymaster is IPaymaster, Ownable {
    using UserOperationLib for PackedUserOperation;

    IEntryPoint public immutable entryPoint;
    
    // A mapping to whitelist specific target contracts
    mapping(address => bool) public supportedTargets;

    // Custom errors for gas efficiency
    error UnsupportedTarget();
    error InvalidPaymasterAndDataLength();
    error InvalidTimestamp();

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
        PackedUserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* maxCost */
    ) external view override returns (bytes memory context, uint256 validationData) {
        // Extract paymaster fields from paymasterAndData
        (address paymaster, , ) = UserOperationLib.unpackPaymasterStaticFields(userOp.paymasterAndData);

        // Ensure the paymaster in the data is this contract
        require(paymaster == address(this), "AA93 invalid paymasterAndData");

        // Extract target from callData (assuming it's encoded as target + data)
        address target = _extractTargetFromCallData(userOp.callData);

        // Check if target is supported
        if (!supportedTargets[target]) revert UnsupportedTarget();

        // Extract time validation data from paymasterAndData
        (uint48 validUntil, uint48 validAfter) = _extractTimeValidation(userOp.paymasterAndData);

        // Validate time range
        if (block.timestamp < validAfter || block.timestamp > validUntil) revert InvalidTimestamp();
        
        // Pack validation data
        validationData = _packValidationData(false, validUntil, validAfter);

        // Return empty context for this simple paymaster
        return ("", validationData);
    }

    /**
     * @dev The function that the EntryPoint calls after the execution to charge the Paymaster.
     */
    function postOp(
        PostOpMode /* mode */,
        bytes calldata /* context */,
        uint256 /* actualGasCost */,
        uint256 /* actualUserOpFeePerGas */
    ) external override {
        // For this simple paymaster, we don't need to do anything in postOp
        // The EntryPoint has already deducted the gas cost from our deposit
    }

    /**
     * @dev Helper function to extract target address from callData.
     * Assumes callData format: target(20 bytes) + function call data
     */
    function _extractTargetFromCallData(bytes calldata callData) internal pure returns (address) {
        // This function now assumes the callData is for a function like `execute(address dest, ...)`
        // where the target address is the first argument.
        // The address is encoded in the first 32-byte word after the 4-byte selector.
        require(callData.length >= 36, "Paymaster: invalid callData for target extraction");
        // Extract the address from the first parameter of the ABI-encoded calldata.
        // An address is a 20-byte value, right-padded in a 32-byte word. We slice from byte 16 to 36.
        return address(bytes20(callData[16:36]));
    }

    /**
     * @dev Extract time validation data from paymasterAndData.
     * Format after static fields: validUntil(6 bytes) + validAfter(6 bytes)
     */
    function _extractTimeValidation(bytes calldata paymasterAndData) internal pure returns (uint48 validUntil, uint48 validAfter) {
        require(paymasterAndData.length >= UserOperationLib.PAYMASTER_DATA_OFFSET + 12, "Paymaster: invalid time data");
        
        validUntil = uint48(bytes6(paymasterAndData[UserOperationLib.PAYMASTER_DATA_OFFSET:UserOperationLib.PAYMASTER_DATA_OFFSET + 6]));
        validAfter = uint48(bytes6(paymasterAndData[UserOperationLib.PAYMASTER_DATA_OFFSET + 6:UserOperationLib.PAYMASTER_DATA_OFFSET + 12]));
    }

    /**
     * @dev Pack validation data according to ERC-4337 standard.
     */
    function _packValidationData(bool sigFailed, uint48 validUntil, uint48 validAfter) internal pure returns (uint256) {
        return
            (sigFailed ? 1 : 0) |
            (uint256(validUntil) << 160) |
            (uint256(validAfter) << (160 + 48));
    }

    /**
     * @dev Create paymasterAndData for a UserOperation.
     */
    function createPaymasterAndData(
        uint256 verificationGasLimit,
        uint256 postOpGasLimit,
        uint48 validUntil,
        uint48 validAfter
    ) external view returns (bytes memory) {
        return abi.encodePacked(
            address(this),                    // paymaster address (20 bytes)
            uint128(verificationGasLimit),    // verification gas limit (16 bytes)
            uint128(postOpGasLimit),          // post-op gas limit (16 bytes)
            validUntil,                       // valid until (6 bytes)
            validAfter                        // valid after (6 bytes)
        );
    }
}