# 已合并至 docs/RUNBOOK.md
（本文件保留以免链接失效，内容已迁移，后续请直接查看 `RUNBOOK.md`）

### Context Refresh — 2025-12-12
- On-chain withdraw verification is now green: the Groth16 proof test (`test/integration/withdraw-onchain-verification.test.ts`) uses snarkjs calldata export to avoid coordinate ordering mistakes and cross-checks circuit/contract Poseidon hashes. `circuits/withdraw.circom` now derives `nullifier` and `publicInputsHash` internally (inputs: secret, amount, pathElements, pathIndices).
- ZK assets rebuilt from circom 2.1.6 and copied into canonical paths: `circuits/withdraw_js/withdraw.wasm`, `circuits/withdraw_0001.zkey`, and `frontend/public/zk/withdraw.{wasm,zkey}`. Solidity verifier refreshed at `contracts/Groth16Verifier.sol`.
- Frontend Vitest suite is fully passing after tightening `WithdrawForm` harness props and relaxing local cache expectations to account for `lastSyncedAt`. Coverage report generated in the latest run.
- Hardhat suite is fully passing; Paymaster unit tests now impersonate EntryPoint for sponsorship checks to hit the intended code paths. Contracts config uses checksum addresses (EXECUTOR_ADDRESS updated).
- Pending/high-priority next steps: expand AA/EntryPoint negative-path coverage (gas fields, timestamp windows, replay), and re-run coverage (`npx hardhat coverage`, `uv run python tasks/test_all.py --coverage`) once AA additions land.
