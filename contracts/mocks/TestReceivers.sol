// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract TestRecipient {
    uint256 public totalReceived;

    event FundsReceived(address indexed sender, uint256 amount);

    receive() external payable {
        totalReceived += msg.value;
        emit FundsReceived(msg.sender, msg.value);
    }
}

contract RevertingRecipient {
    receive() external payable {
        revert("Rejecting funds");
    }
}
