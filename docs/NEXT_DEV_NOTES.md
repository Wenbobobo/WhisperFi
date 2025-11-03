# Next Developer Notes (Iteration Continuation)

Scope: continue the TDD-driven refactor and test expansion towards commercial readiness on Windows + `uv`.

What’s just been completed

- Frontend withdraw flow refactored into `createWithdrawFlow` service with cached deposit log loader and expanded Vitest coverage.
- Circuit-compatible Merkle helper now mirrors on-chain tree; `MerkleConsistency` regression ensures parity.
- Paymaster + deploy scripts hardened (caller guard, validated config artefacts).
- Docs: CODE_REVIEW updated to mark remediated blockers and highlight new flow architecture.

Short plan (TDD-first)

- Frontend
  - Polish the new local-storage commitment cache (TTL, manual reset UX, multi-tab coordination).
    - Track latest sync timestamp and invalidate cache when staleness threshold exceeded.
    - Surface “Reset commitment cache” action in withdraw UI when proof generation fails repeatedly.
    - Consider broadcasting updates via `storage` event for multi-tab coherence.
  - Add submit-path assertions (fee-bearing withdrawals, relayer payout) on top of existing mocked tests.
  - Evaluate moving WASM fetching/validation into a dedicated hook that cooperates with Next.js streaming.
- Contracts / AA
  - Extend EntryPoint/AA cases: invalid gas fields, replay protections, unsupported target variations.
  - Add PrivacyPool edge cases: near-capacity tree behavior, non-zero relayer path, invalid recipients.
- ZK alignment
  - Wire a circuit-compatible Merkle tree in `withdraw-onchain-verification.test.ts` to produce real pathElements/pathIndices.
  - Reconfirm public inputs order: `[merkleRoot, nullifier]` hashed by Poseidon(2), no padding beyond 32 bytes.
- Docs & hygiene
  - Capture deployment smoke-test outputs in CI notes; keep outdated docs in `docs/archive/`.
  - No CI yet per instruction; record workflows as TODOs.

Exploratory backlog

- Evaluate backend options for Merkle snapshots:
  1. **Client-only cache** (short term): persist commitments + block height locally; reconcile on load.
  2. **Relayer-assisted** (mid term): extend relayer to expose `/commitments` endpoint returning latest root and proofs.
  3. **Managed indexer** (long term): integrate The Graph/subgraph to serve commitment indices and proofs across clients.
- Investigate lightweight indexer/relayer endpoint to serve Merkle snapshots and path proofs to the dApp.
- Define SLA targets for withdrawal latency to prioritise caching vs. backend work.

Commands (Windows + uv)

- Contracts: `npx hardhat test` | Coverage: `npx hardhat coverage`
- Frontend: `cd frontend && npm run test`
- Unified: `uv run python tasks/test_all.py` (add `--coverage`, `--e2e` as needed)

Gotchas

- Coverage skips heavy ZK tests automatically; use normal runs for ZK integration.
- Ensure `.wasm`/`.zkey` assets exist at canonical paths before enabling on-chain verification tests.
- Testing-library needs cleanup between tests (already enabled in `frontend/vitest.setup.ts`).
