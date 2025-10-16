# Next Developer Notes (Iteration Continuation)

Scope: continue the TDD-driven refactor and test expansion towards commercial readiness on Windows + `uv`.

What’s just been completed

- Frontend tests: stabilized `WithdrawForm` test (cleanup added) and added a mocked `WithdrawCard` flow test.
- Bug fix: `WithdrawCard` now passes the note directly to `generateProof` to avoid stale state reads.
- AA tests: added Paymaster time-window validation test covering `validAfter` rejection.
- Docs: updated DEV_HANDOVER_NOTES and TESTING_GUIDE with test tips.

Short plan (TDD-first)

- Frontend
  - Continue splitting `WithdrawCard` into proof-builder, submitter, and pure UI.
  - Add component tests for error states (no deposit events, commitment not found, proof errors) with mocked wagmi.
  - Keep heavy proof generation mocked for speed; exercise real WASM/ZKey only in integration.
- Contracts / AA
  - Extend EntryPoint/AA cases: invalid gas fields, replay protections, unsupported target variations.
  - Add PrivacyPool edge cases: near-capacity tree behavior, non-zero relayer path, invalid recipients.
- ZK alignment
  - Wire a circuit-compatible Merkle tree in `withdraw-onchain-verification.test.ts` to produce real pathElements/pathIndices.
  - Reconfirm public inputs order: `[merkleRoot, nullifier]` hashed by Poseidon(2), no padding beyond 32 bytes.
- Docs & hygiene
  - Minor link updates; keep outdated docs in `docs/archive/`.
  - No CI yet per instruction; record workflows as TODOs.

Commands (Windows + uv)

- Contracts: `npx hardhat test` | Coverage: `npx hardhat coverage`
- Frontend: `cd frontend && npm run test`
- Unified: `uv run python tasks/test_all.py` (add `--coverage`, `--e2e` as needed)

Gotchas

- Coverage skips heavy ZK tests automatically; use normal runs for ZK integration.
- Ensure `.wasm`/`.zkey` assets exist at canonical paths before enabling on-chain verification tests.
- Testing-library needs cleanup between tests (already enabled in `frontend/vitest.setup.ts`).

