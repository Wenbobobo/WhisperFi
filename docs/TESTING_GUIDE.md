# Testing Guide

This project uses a layered testing strategy:

- Unit (Hardhat + Mocha/Chai): Contract-level behaviors in isolation.
- Integration (Hardhat + Node): Cross-component flows including ZK resources and Poseidon consistency.
- E2E (Hardhat + AA flow): UserOperation-based scenarios; optional Playwright for UI flows.
- Frontend (Vitest): Utility and logic tests (e.g., `src/utils/crypto.ts`).

Directory Layout

- `test/unit` – contract unit tests
- `test/integration` – hash consistency, deposit/withdraw, zk-proof-generation
- `test/e2e` – AA end-to-end flows and Playwright specs
- `test/utils` – test helpers
- `test/legacy` – ad-hoc scripts retained for reference

Recent additions

- `test/integration/withdraw-relayer-fee.test.ts` — validates fee-bearing withdrawals split funds between recipient and relayer using the mock verifier fixture.

Commands

- Contracts (all): `npx hardhat test`
- Contracts (by scope):
  - `npx hardhat test "test/unit/**/*.ts"`
  - `npx hardhat test "test/integration/**/*.ts"`
  - `npx hardhat test "test/e2e/**/*.ts"`
- Frontend: `cd frontend && npm run test`
- Playwright UI E2E: `npx playwright test`
 - Optional on-chain ZK proof: `ZK_ONCHAIN=1 npx hardhat test test/integration/withdraw-onchain-verification.test.ts`

Windows + uv

- All (contracts + frontend): `uv run python tasks/test_all.py`
- With scopes: `uv run python tasks/test_all.py --contracts unit --frontend`
- Add `--e2e` to include Playwright (requires browsers installed).
 - Add `--coverage` for solidity-coverage.

Notes

- Poseidon consistency is validated against circomlibjs-generated contracts via `scripts/deploy-poseidon*.ts`.
- ZK assets are large; ensure paths point to the checked-in `.wasm` and `.zkey` files.
- E2E tests assume local Hardhat network and configured Paymaster support.
- Playwright harness may leverage `frontend/src/e2e/helpers.ts` and `frontend/tests/utils/walletMock.js` for auto-connect and cache seeding when the dual-tab scenario is enabled.
- Playwright specs are under `frontend/tests` and configured via `playwright.config.ts`.
- Vitest: tests auto-cleanup via `vitest.setup.ts` (prevents duplicate renders). When asserting async UI updates, prefer `waitFor`.

ZK On-chain Proof Tips

- Before running with `ZK_ONCHAIN=1`, recompile circuits so the WASM/ZKey reflect the latest `circuits/withdraw.circom`:
  - `npm run compile-circuits`
  - Test looks for `circuits/build/withdraw/withdraw_js/withdraw.wasm` and `circuits/build/withdraw/withdraw_0001.zkey`.
- Frontend uses `frontend/public/zk/withdraw.wasm` and `frontend/public/zk/withdraw.zkey`. Copy the build outputs there if you want the UI to use newly compiled artifacts.
- If the ZKey is missing or outdated, generate it from the compiled R1CS and the bundled Powers of Tau file:
  - `npm run zkey:withdraw`
- Note (Windows): if you hit circom parse errors, consider using WSL or Docker for circuit compilation; the on-chain test will skip if artifacts are inconsistent.
