// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface ITestVerifier {
    function verifyProof(uint[2] calldata, uint[2][2] calldata, uint[2] calldata, uint[1] memory) external view returns (bool);
}

contract TestWithdraw {
    event WithdrawCalled(address recipient);

    ITestVerifier public immutable verifier;
    address public immutable hasher;
    address public immutable hasher5;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    constructor(address _verifier, address _hasher, address _hasher5) {
        verifier = ITestVerifier(_verifier);
        hasher = _hasher;
        hasher5 = _hasher5;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    function withdraw(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        bytes32 _proofRoot,
        bytes32 _nullifier,
        address payable _recipient,
        uint256 _fee,
        address payable _relayer
    ) external nonReentrant {
        emit WithdrawCalled(_recipient);
    }
}
