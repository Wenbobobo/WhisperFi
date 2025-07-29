// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { IVerifier } from "./IVerifier.sol";

/**
 * @title MockVerifier
 * @notice Mock implementation of IVerifier for testing purposes
 * @dev This contract provides configurable behavior for verifyProof, allowing comprehensive testing
 * of both success and failure paths. Should NEVER be used in production.
 */
contract MockVerifier is IVerifier {
    bool private _shouldReturnTrue = true;
    
    /**
     * @notice Sets the mock verification result
     * @dev This allows tests to control whether proof verification succeeds or fails
     * @param shouldSucceed Whether subsequent verifyProof calls should return true
     */
    function setMockResult(bool shouldSucceed) external {
        _shouldReturnTrue = shouldSucceed;
    }
    
    /**
     * @notice Mock proof verification with configurable result
     * @dev This is for testing only - bypasses all cryptographic verification
     * @param _pA Proof point A (ignored)
     * @param _pB Proof point B (ignored)
     * @param _pC Proof point C (ignored)
     * @param _pubSignals Public signals (ignored)
     * @return The configured mock result
     */
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[1] calldata _pubSignals
    ) external view override returns (bool) {
        // Suppress unused parameter compile warnings
        (_pA, _pB, _pC, _pubSignals);
        
        // Return the configured mock result
        return _shouldReturnTrue;
    }
}