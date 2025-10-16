Test Suite Structure

- unit: Fast tests for individual contracts and functions (mocha/chai under Hardhat).
- integration: Cross-component flows and on-chain + off-chain interactions.
- e2e: User-level scenarios (AA flow) and optional Playwright UI tests.
- utils: Shared test helpers (no tests here).
- legacy: Ad-hoc scripts kept for reference; not run in CI by default.

How To Run

- Contracts (all): npx hardhat test
- Contracts (unit): npx hardhat test test/unit
- Contracts (integration): npx hardhat test test/integration
- Contracts (e2e): npx hardhat test test/e2e
- Frontend (vitest): cd frontend && npm run test
- Playwright E2E: npx playwright test

Windows + uv

- All (contracts + frontend): uv run python tasks/test_all.py
- With scopes: uv run python tasks/test_all.py --contracts unit --frontend
- Add --e2e to include Playwright (requires browsers installed).

