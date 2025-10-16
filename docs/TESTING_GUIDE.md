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

Commands

- Contracts (all): `npx hardhat test`
- Contracts (by scope):
  - `npx hardhat test test/unit`
  - `npx hardhat test test/integration`
  - `npx hardhat test test/e2e`
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
- Playwright specs are under `frontend/tests` and configured via `playwright.config.ts`.
