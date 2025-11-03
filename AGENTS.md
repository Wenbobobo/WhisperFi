# Repository Guidelines

## Project Structure & Module Organization
Monorepo splits Solidity privacy primitives in `contracts/`, circom workflows in `circuits/`, and deployment helpers in `scripts/`. Hardhat + zk tests live in `test/` (segmented into `unit/`, `integration/`, `e2e/` with shared fixtures in `test/environment.ts`), while the Next.js dApp sits under `frontend/` and the Flashbots relayer under `relayer/`. Reference materials stay in `docs/` and `legacy-tests/`; new automation belongs in `tasks/` so it loads from `hardhat.config.ts`.

## Build, Test, and Development Commands
- `npm install` then `npm run compile` to refresh Solidity artifacts with Cancun settings.
- `npm run compile-circuits` whenever `circuits/*.circom` or Poseidon parameters change.
- `npm test` for the full Hardhat suite; `npm run coverage` before security-sensitive merges.
- Inside `frontend/`: `npm install`, `npm run dev`, and `npm run build` for release checks.
- Front-end quality gates: `npm run lint`, `npm test`, and `npx playwright test` when UI flows change.

## Coding Style & Naming Conventions
TypeScript and TSX follow Prettier defaults (2-space indent, trailing commas, single quotes) backed by Next ESLint; export React components in PascalCase and hooks in camelCase. Solidity sources require SPDX headers, 4-space indentation, explicit visibility, and NatSpec on public/external APIs. Task scripts, relayer services, and tests should use async/await with descriptive filenames like `PrivacyPool.deposits.multiple.test.ts`.

## Testing Guidelines
- Leverage `test/setup.ts` fixtures for deterministic Hardhat state; keep helpers in `test/utils/`.
- Name new suites `{Contract|Feature}.{behavior}.test.ts` to mirror existing organization.
- Target the coverage expectations recorded in `docs/TESTING_GUIDE.md`; update the doc if thresholds shift.
- Front-end specs belong in `frontend/tests/` (Vitest) with wagmi mocks from `vitest.setup.ts`; reserve Playwright for cross-stack flows that hit the relayer.

## Commit & Pull Request Guidelines
Prefer conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`) as already used in `git log`, and keep subjects imperative. PR descriptions should outline scope, list verification commands, link roadmap issues, and attach UI screenshots or relayer logs when behavior changes. Never commit generated outputs (`artifacts/`, `cache/`, `circuits/build/`, `frontend/.next/`); extend `.gitignore` if new build assets appear.

## Security & Configuration Tips
Store RPC keys, paymaster secrets, and Flashbots auth data in untracked `.env` files and reference them via Hardhat or Next runtime config. After touching circom inputs or zkey material, regenerate with `npm run compile-circuits`, archive hashes in `docs/DEV_HANDOVER_NOTES.md`, and sanitize relayer logs before sharing.
