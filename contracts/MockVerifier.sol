// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { IVerifier } from "./IVerifier.sol";

/**
 * @title MockVerifier
 * @notice Mock implementation of IVerifier for testing purposes
 * @dev This contract always returns true for verifyProof, allowing tests to focus on business logic
 * rather than ZK proof generation. Should NEVER be used in production.
 */
contract MockVerifier is IVerifier {
    /**
     * @notice Mock proof verification that always returns true
     * @dev This is for testing only - bypasses all cryptographic verification
     * @param _pA Proof point A (ignored)
     * @param _pB Proof point B (ignored) 
     * @param _pC Proof point C (ignored)
     * @param _pubSignals Public signals (ignored)
     * @return true Always returns true for testing
     */
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[1] calldata _pubSignals
    ) external pure override returns (bool) {
        // Suppress unused parameter compile warnings
        (_pA, _pB, _pC, _pubSignals);
        
        // Always return true for testing
        return true;
    }
}