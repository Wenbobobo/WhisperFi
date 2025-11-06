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
    - [ ] Add Playwright smoke (two contexts) to confirm cache reset/refresh propagates visually:
      - Skeleton lives in `frontend/tests/withdraw.cache-sync.playwright.ts` but remains skipped until wallet-mocking harness stabilises.
      - TODOs before enabling:
        1. Provide an init script that mirrors wagmi `autoConnect` (stub `window.ethereum` and preload `wagmi.store`; see placeholder `frontend/tests/utils/walletMock.js`).
        2. Add a lightweight helper on `window.__e2e__` (e.g. `seedCommitments({ commitments, lastBlock, chainId })`) so tests can seed cache without raw script injection; export from a dedicated E2E module (`frontend/src/e2e/helpers.ts`) and register in `_app`/`Providers`.
        3. Assert that Tab B’s status panel transitions visible → hidden → visible after a manual refresh, and validate localStorage keys are purged; ensure tests wait for broadcast events rather than relying on timeouts.
        4. Document manual verification steps (dual-context instructions) in `TESTING_GUIDE.md` once the harness is stable.
        5. Make the mock wallet flip wagmi’s internal state so `useAccount` exposes the Hardhat `chain.id`; at the moment the UI hides the connect button via `forceConnected`, but `createLocalStoragePersistor` still receives `chainId = 0`, so seeded cache entries under `31337` never hydrate.
  - Add submit-path assertions (fee-bearing withdrawals, relayer payout) on top of existing mocked tests.
  - Integration backlog:
    - [x] Extend Hardhat integration (`test/integration/withdraw-relayer-fee.test.ts`) to execute `withdraw` with non-zero fee + relayer, asserting emitted events and balance splits via the mock verifier.
    - [x] Add a Vitest harness for `createWithdrawFlow.submitWithdrawal` to assert relayer fee + account/chain metadata propagate to `writeContract`.
    - [ ] Follow up with Playwright flow that drives the UI against a local Hardhat node, covering fee entry, relayer payout confirmation, and cache status updates.
      - Requirements: deterministic relayer account + fixture script to mint mock notes, expose withdraw form without manual wallet interaction, and mock proof generation (`generateWithdrawProof`) for speed.
      - Plan: add a Hardhat script/fixture to emit `Deposit` events for a known note, expose a `window.__e2e__.mockProof()` stub in the frontend (returns canned proof/publicSignals/nullifier), and drive the withdraw form in Playwright (set fee > 0, verify relayer balance via Hardhat RPC).
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
- `npx playwright test` currently hangs on `withdraw.cache-sync` until the auto-connect harness reports a connected account; expect timeouts unless TODO (5) above is addressed or the spec is temporarily skipped.
