# Repository Guidelines

This monorepo hosts WhisperFi (Private DeFi): Solidity privacy primitives, Circom circuits, a Next.js dApp, and a Flashbots relayer.  
This file defines how humans and AI agents should work here, combining project layout, workflows, and the core engineering principles from `docs/` and `Virtues.md`.

**Single sources of truth**
- Architecture, interfaces, and current design decisions live in `docs/TECHNICAL_SPECIFICATION.md`.
- Project status and roadmap live in `docs/MASTER_TASK_TRACKING.md` and `docs/NEXT_DEV_NOTES.md`.
- Risks and remediation live in `docs/CODE_REVIEW.md` and `docs/DEV_HANDOVER_NOTES.md`.
- Testing strategy and commands live in `docs/TESTING_GUIDE.md`.

Before making non-trivial changes, skim the relevant doc(s) above and prefer reusing existing patterns over inventing new ones.

## Project Structure & Module Organization
Monorepo splits Solidity privacy primitives in `contracts/`, circom workflows in `circuits/`, and deployment helpers in `scripts/`. Hardhat + zk tests live in `test/` (segmented into `unit/`, `integration/`, `e2e/` with shared fixtures in `test/environment.ts` and `test/setup.ts`), while the Next.js dApp sits under `frontend/` and the Flashbots relayer under `relayer/`. Reference materials stay in `docs/` and `legacy-tests/`; new automation belongs in `tasks/` so it loads from `hardhat.config.ts` and `tasks/test_all.py`.

When touching core flows (Poseidon, Merkle, withdraw, AA, relayer), always check the relevant sections in `docs/TECHNICAL_SPECIFICATION.md` and `docs/CODE_REVIEW.md` first to stay aligned with the intended architecture and known risks.

## Build, Test, and Development Commands
- `npm install` then `npm run compile` to refresh Solidity artifacts with Cancun settings.
- `npm run compile-circuits` whenever `circuits/*.circom` or Poseidon parameters change; record important artifact hashes or regeneration notes in `docs/DEV_HANDOVER_NOTES.md` when they matter for verification.
- Contracts: `npx hardhat test` for the full Hardhat suite; `npx hardhat coverage` before security-sensitive merges or when touching critical paths like withdraw/Paymaster/Poseidon.
- Frontend: inside `frontend/` use `npm install`, `npm run dev`, `npm run build`, and `npm run test` for logic/UX changes.
- Playwright flows (cache sync, fee flow, broader E2E) should be wrapped with `tools/scripts/timeout-wrapper.ps1` to avoid hung browsers, as described in `docs/TESTING_GUIDE.md`.
- Unified runs on Windows: prefer `uv run python tasks/test_all.py` (add `--contracts`, `--frontend`, `--e2e`, `--coverage` as needed) for a realistic “definition of done” check.

**Definition of Done**
- Functionality is implemented according to the relevant docs/specs (see above).
- No placeholder logic or mock data remains in production code paths.
- The code compiles and runs (contracts/front-end and, if relevant, circuits).
- All relevant tests pass with **no new failing or unexpectedly skipped tests**:
  - At minimum: `npx hardhat test` for contract changes; `cd frontend && npm run test` for frontend logic changes.
  - For cross-stack changes or handover-level work, run `uv run python tasks/test_all.py` with appropriate flags.
- Temporary servers/processes started for debugging (e.g. local Hardhat, Playwright) are stopped or managed via scripts (e.g. the timeout wrapper) so they don’t linger.

Never declare a task “done” if tests are failing, silently skipped, or if key flows (withdraw, fee splitting, Merkle, Poseidon) are only partially covered by tests.

## Coding Style & Naming Conventions
TypeScript and TSX follow Prettier defaults (2-space indent, trailing commas, single quotes) backed by Next ESLint; export React components in PascalCase and hooks in camelCase. Favor strong typing and avoid `any` unless absolutely necessary; if you must use `any`, briefly explain why in a comment next to the declaration. Prefer async/await over raw promises.

Solidity sources require SPDX headers, 4-space indentation, explicit visibility, and NatSpec on public/external APIs. Keep contract interfaces in sync with `docs/TECHNICAL_SPECIFICATION.md`; when you change a public API, update the doc and tests in the same change. Error types and revert reasons should be clear and specific.

Task scripts, relayer services, and tests should use async/await with descriptive filenames like `PrivacyPool.deposits.multiple.test.ts`. Names should reflect intent, not implementation details. Remove dead code and large commented-out blocks instead of leaving them in place; rely on git history instead of comments like “// fixed bug” or “// temporary change”.

Good code should be self-explanatory. Use comments sparingly to explain *why* something is done (business rules, security tradeoffs, ZK constraints), not *what* each line does. Never weaken linting or type checks just to “get it to compile”; fix the underlying issues instead.

## Testing Guidelines
- Leverage `test/setup.ts` fixtures and `test/utils/` helpers for deterministic Hardhat state; prefer existing fixtures over ad-hoc deployments.
- Name new suites `{Contract|Feature}.{behavior}.test.ts` to mirror existing organization and keep tests discoverable.
- Target the coverage expectations recorded in `docs/TESTING_GUIDE.md`; if coverage thresholds or scope materially change, update that doc alongside your code.
- Frontend specs belong in `frontend/tests/` (Vitest) with wagmi mocks from `vitest.setup.ts`; reserve Playwright for cross-stack flows that hit the relayer, commitment cache, or withdraw UI.
- For critical flows (Merkle consistency, Poseidon hashing, withdraw with relayer fee, AA paths), ensure tests assert **non-trivial work** happened: non-zero items processed, balances mutated as expected, events emitted, or UI states transitioned. Avoid vacuous tests that pass without exercising core logic.
- Treat any failing test (existing or new) as a bug that blocks completion. Do not comment out tests, add `skip`/`only`, or reduce assertions to “make things green” unless the underlying specification has changed and the docs were updated first.

For ZK-heavy and on-chain proof tests, follow `docs/TESTING_GUIDE.md` for commands and artifact locations. If you change circuit behavior or asset paths, update both the tests and the doc.

## Commit & Pull Request Guidelines
Prefer conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`) as already used in `git log`, and keep subjects imperative. PR descriptions should:
- Outline scope and user-visible behavior changes.
- List verification commands you actually ran (e.g. `npx hardhat test`, `cd frontend && npm run test`, `uv run python tasks/test_all.py --contracts integration --frontend`, Playwright commands with the timeout wrapper).
- Link relevant roadmap issues or sections in `docs/MASTER_TASK_TRACKING.md` / `docs/NEXT_DEV_NOTES.md` when the change advances a tracked item.
- Attach UI screenshots or relayer logs when behavior changes materially (withdraw flow, cache status, fee display, relayer payout).

Never commit generated outputs (`artifacts/`, `cache/`, `circuits/build/`, `frontend/.next/`, Playwright `test-results/`); extend `.gitignore` if new build assets appear. Keep diffs as focused as possible: avoid drive-by reformatting or broad refactors mixed into bug fixes or feature PRs.

For AI or automation-based contributions, keep changes small and well-scoped, do not introduce new dependencies without clear justification, and never disable or weaken tests to get a passing run.

## Security & Configuration Tips
Store RPC keys, paymaster secrets, and Flashbots auth data in untracked `.env` files and reference them via Hardhat or Next runtime config. Do not hard-code secrets or commit `.env*` files. When in doubt, treat anything that could reveal private keys, mnemonics, or infrastructure endpoints as sensitive.

After touching circom inputs or zkey material, regenerate with `npm run compile-circuits`, ensure artifacts are wired to both contracts and frontend as per `docs/TESTING_GUIDE.md`, archive hashes or regeneration notes in `docs/DEV_HANDOVER_NOTES.md`, and sanitize relayer logs before sharing. Preserve Poseidon alignment across contracts, circuits, and frontend (`crypto.ts`); changes that might affect hashing or Merkle behavior must be backed by updated tests and an explicit note in `docs/TECHNICAL_SPECIFICATION.md` or `docs/CODE_REVIEW.md`.

Relayer and trade paths are currently partially experimental as documented in `docs/CODE_REVIEW.md` and `docs/NEXT_DEV_NOTES.md`. Keep experimental code paths guarded and clearly labeled; do not silently promote them to production-critical paths without updating docs, tests, and deployment runbooks.
