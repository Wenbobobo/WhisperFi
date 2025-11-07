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
    - [x] Track latest sync timestamp and invalidate cache when staleness threshold exceeded (loader now records `lastSyncedAt`/`expiresAt` and UI surfaces the data).
    - [x] Surface “Reset commitment cache” action in withdraw UI when proof generation fails repeatedly.
    - [x] Implement multi-tab coordination via `BroadcastChannel` + `storage` event fallback; loader publishes (`refresh`/`clear`) and UI resubscribes (see `logSource.test.ts` multi-tab cases).
    - [x] Add Playwright smoke (two contexts) to confirm cache reset/refresh propagates visually:
      - `frontend/tests/withdraw.cache-sync.playwright.ts` now runs green using the wallet mock + `/e2e/withdraw` route; continue expanding UI assertions as the harness stabilises.
    - [x] Hydrate cache status from persisted localStorage so reloads (and tests) immediately display “Cache last synced…” metadata without rerunning Merkle scans.
  - Add submit-path assertions (fee-bearing withdrawals, relayer payout) on top of existing mocked tests.
    - [x] Fee-bearing Playwright flow (`frontend/tests/withdraw.fee-flow.playwright.ts`) now covers recipient/relayer/fee propagation via mocked proof + submission override. Still pending: hook into a funded Hardhat relayer for balance verification.
  - Integration backlog:
    - [x] Extend Hardhat integration (`test/integration/withdraw-relayer-fee.test.ts`) to execute `withdraw` with non-zero fee + relayer, asserting emitted events and balance splits via the mock verifier.
    - [x] Add a Vitest harness for `createWithdrawFlow.submitWithdrawal` to assert relayer fee + account/chain metadata propagate to `writeContract`.
    - [x] Follow up with Playwright flow that drives the UI against a local Hardhat node, covering fee entry, relayer payout confirmation, and cache status updates (current spec still uses mocked submit override for proof generation but now executes the on-chain withdrawal via Hardhat).
    - [ ] Long-term: replace the mock proof path with real Groth16 generation (once WASM loading is stabilised) so the Playwright flow exercises the full stack without `USE_MOCK_VERIFIER`.
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
- Cache sync E2E (once added): `npm run test -- logSource`, `npm run test -- WithdrawCard`, and `npx playwright test`

Gotchas

- Coverage skips heavy ZK tests automatically; use normal runs for ZK integration.
- Ensure `.wasm`/`.zkey` assets exist at canonical paths before enabling on-chain verification tests.
- Testing-library needs cleanup between tests (already enabled in `frontend/vitest.setup.ts`).
- Playwright specs rely on the wallet mock + `/e2e/withdraw` route and are stable, but they still take ~1–1.5 minutes; keep wrapping commands with `tools/scripts/timeout-wrapper.ps1 -TimeoutSeconds 240` to ensure hung browsers are killed automatically.
