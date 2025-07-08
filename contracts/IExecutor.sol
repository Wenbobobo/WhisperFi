// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IExecutor {
    function execute(address target, bytes calldata callData) external;
}
