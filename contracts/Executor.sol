// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Executor is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    function execute(address target, bytes memory callData) external onlyOwner {
        (bool success, ) = target.call(callData);
        require(success, "External call failed");
    }
}