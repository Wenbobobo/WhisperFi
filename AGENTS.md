# WhisperFi Repository Guidelines & Engineering Principles

This monorepo hosts WhisperFi (Private DeFi): Solidity privacy primitives, Circom circuits, a Next.js dApp, and a Flashbots relayer.

This file defines how humans and AI agents should work here, combining project layout, workflows, coding style, and core engineering principles.

---

## Part 1: Single Sources of Truth

| Document | Purpose |
|----------|---------|
| `docs/TECHNICAL_SPECIFICATION.md` | Architecture, interfaces, design decisions |
| `docs/MILESTONES.md` | Roadmap, task breakdown, progress tracking |
| `docs/MASTER_TASK_TRACKING.md` | Status timeline and completion log |
| `docs/CODE_REVIEW.md` | Risks and remediation tracking |
| `docs/TESTING_GUIDE.md` | Testing strategy and commands |
| `docs/RUNBOOK.md` | Daily operations and handover notes |

Before making non-trivial changes, skim the relevant doc(s) above and prefer reusing existing patterns over inventing new ones.

---

## Part 2: Project Structure & Module Organization

```
private-defi/
├── contracts/              # Solidity privacy primitives
│   ├── PrivacyPool.sol     # Core privacy pool
│   ├── Groth16Verifier.sol # ZK proof verifier
│   ├── SmartAccount.sol    # ERC-4337 account
│   ├── SmartAccountFactory.sol
│   ├── Paymaster.sol       # Gas sponsorship
│   └── lib/                # Utility libraries
├── circuits/               # Circom ZK circuits
│   ├── deposit.circom
│   ├── withdraw.circom
│   └── build/              # Compiled artifacts
├── frontend/               # Next.js dApp
│   ├── src/components/     # React components
│   ├── src/lib/            # Business logic
│   ├── src/utils/          # Crypto utilities
│   └── tests/              # Vitest + Playwright
├── relayer/                # Flashbots MEV protection
├── test/                   # Hardhat test suite
│   ├── unit/               # Contract unit tests
│   ├── integration/        # Cross-component tests
│   ├── e2e/                # End-to-end AA flows
│   └── utils/              # Test helpers
├── scripts/                # Deployment scripts
├── tasks/                  # Automation tasks
└── docs/                   # Documentation
```

When touching core flows (Poseidon, Merkle, withdraw, AA, relayer), always check `docs/TECHNICAL_SPECIFICATION.md` and `docs/CODE_REVIEW.md` first.

---

## Part 3: Build, Test, and Development Commands

### Setup
```bash
npm install                    # Root dependencies
cd frontend && npm install     # Frontend dependencies
```

### Contracts
```bash
npx hardhat compile            # Compile with Cancun settings
npx hardhat test               # Full test suite
npx hardhat coverage           # Coverage report
```

### ZK Circuits
```bash
npm run compile-circuits       # Compile circuits (or use WSL)
npm run zkey:withdraw          # Generate zkey
npm run verifier:withdraw      # Export Solidity verifier
```

### Frontend
```bash
cd frontend
npm run dev                    # Development server
npm run build                  # Production build
npm run test                   # Vitest with coverage
```

### E2E Tests (Playwright)
```bash
# Windows: use timeout wrapper to prevent hung browsers
./tools/scripts/timeout-wrapper.ps1 -Command 'npx playwright test' -TimeoutSeconds 240
```

### Unified Run (Windows + uv)
```bash
uv run python tasks/test_all.py                 # All tests
uv run python tasks/test_all.py --contracts     # Contracts only
uv run python tasks/test_all.py --frontend      # Frontend only
uv run python tasks/test_all.py --e2e           # Include Playwright
uv run python tasks/test_all.py --coverage      # With coverage
```

---

## Part 4: Definition of Done

A task is "Done" **only** when ALL of the following are satisfied:

### ✅ Must Have
1. **Functionality implemented** according to requirements and specifications
2. **No placeholder logic** or mock data in production code paths
3. **Code compiles and runs** (contracts, frontend, circuits if applicable)
4. **All tests pass** with zero failures and zero unexpected skips:
   - Contracts: `npx hardhat test`
   - Frontend: `cd frontend && npm run test`
   - Cross-stack: `uv run python tasks/test_all.py`
5. **Temporary resources cleaned up** (test servers, processes)

### ❌ Never Acceptable
- Claiming "done" with partial implementation
- Declaring "done" with any failing tests
- Describing intermediate steps as "major milestone"
- Committing code when tests are failing
- Leaving zombie processes running

---

## Part 5: Engineering Principles

### 5.1 Integrity and Test-Driven Diligence

**Principle:** Code without tests is broken by default. A failing test is a bug in the application code, not the test.

**Actions:**
- Execute the **entire** test suite after any code change
- Treat any failure as a **critical stop-work event**
- Fix the **application code** to make tests pass
- Never modify tests just to make them pass
- Iterate until the entire suite passes cleanly

**Never:**
- Comment out tests or add `skip` directives to silence errors
- Stop test execution after first failure
- Weaken assertions to "get things green"

### 5.2 Holistic Contextual Awareness

**Principle:** Before writing code, understand its place in the system architecture.

**Actions:**
- Review existing codebase and architecture docs
- Ask: "Is there an existing implementation for this?"
- Prioritize reusing validated modules and patterns

**Never:**
- Blindly reimplement existing features
- View problems in isolation

### 5.3 Robustness and Prudence

**Principle:** Code must be robust, secure, and handle errors gracefully.

**Actions:**
- Use strong typing; avoid `any` unless documented
- Validate all external inputs rigorously
- Use proper error handling (`Result`, `try-catch`)

**Never:**
- Sacrifice type safety for speed
- Commit code that could panic in production

### 5.4 Pragmatism and Simplicity (YAGNI)

**Principle:** Avoid over-engineering, but never at the cost of correctness.

**Actions:**
- Focus strictly on current requirements
- Choose the simplest solution that satisfies requirements

**Never:**
- Add complexity for "future needs"
- Use YAGNI to skip tests or error handling

### 5.5 Clarity and Self-Documenting Code

**Principle:** Good code is self-explanatory. Comments explain "why", not "what".

**Actions:**
- Use clear, unambiguous naming
- Comment only complex algorithms or business logic

**Never:**
- Write meta-comments like `// Fixed bug XX`
- Leave large blocks of commented-out code
- Use linter suppression to silence warnings

### 5.6 Proof of Work and Meaningful Verification

**Principle:** Tests must prove code *works*, not just that it *doesn't fail*.

**Actions:**
- Assert non-zero work in "happy path" tests
- Verify test setup triggers the logic being tested
- Test both inclusion and exclusion for filters

**Never:**
- Write vacuous tests that pass without exercising logic
- Rely on empty-list tests for data processing features

### 5.7 Resource Stewardship

**Principle:** Keep the development environment clean and available.

**Actions:**
- Auto-shutdown temporary services after task completion
- Provide clear start/stop instructions when manual management is needed

**Never:**
- Leave zombie processes or background services running

---

## Part 6: Coding Style & Naming Conventions

### TypeScript/TSX
- Prettier defaults: 2-space indent, trailing commas, single quotes
- React components in PascalCase, hooks in camelCase
- Strong typing; avoid `any` unless documented
- Prefer async/await over raw promises

### Solidity
- SPDX headers required
- 4-space indentation
- Explicit visibility on all functions
- NatSpec on public/external APIs
- Clear error types and revert reasons
- Keep interfaces in sync with `docs/TECHNICAL_SPECIFICATION.md`

### General
- Descriptive filenames: `PrivacyPool.deposits.multiple.test.ts`
- Names reflect intent, not implementation
- Remove dead code; rely on git history
- Self-explanatory code with minimal comments

---

## Part 7: Testing Guidelines

### Test Organization
- Leverage `test/setup.ts` fixtures and `test/utils/` helpers
- Name suites: `{Contract|Feature}.{behavior}.test.ts`
- Target coverage expectations in `docs/TESTING_GUIDE.md`

### Test Quality
- Assert **non-trivial work**: items processed, balances mutated, events emitted
- Avoid vacuous tests
- Treat failing tests as bugs that block completion
- Never comment out tests or reduce assertions

### Critical Flows
For Merkle consistency, Poseidon hashing, withdraw, and AA paths:
- Ensure comprehensive edge case coverage
- Follow `docs/TESTING_GUIDE.md` for ZK-heavy tests
- Update docs when changing circuit behavior

---

## Part 8: Commit & Pull Request Guidelines

### Commits
- Use conventional prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `test:`
- Keep subjects imperative

### Pull Requests
- Outline scope and user-visible changes
- List verification commands actually run
- Link relevant roadmap items in `docs/MILESTONES.md`
- Attach screenshots/logs for behavior changes

### What NOT to Commit
- Generated outputs: `artifacts/`, `cache/`, `circuits/build/`, `frontend/.next/`, `test-results/`
- `.env` files or secrets
- Drive-by reformatting mixed with feature PRs

### For AI/Automation
- Keep changes small and well-scoped
- Don't introduce dependencies without justification
- Never disable tests to get a passing run

---

## Part 9: Security & Configuration

### Secrets Management
- Store RPC keys, paymaster secrets, Flashbots auth in untracked `.env` files
- Never hard-code secrets
- Reference via Hardhat or Next runtime config

### ZK Assets
- After circuit changes, regenerate with `npm run compile-circuits`
- Archive hashes in `docs/DEV_HANDOVER_NOTES.md`
- Ensure wasm/zkey/verifier consistency across contracts and frontend

### Poseidon Alignment
- Preserve hash consistency across contracts, circuits, and frontend (`crypto.ts`)
- Document any changes in `docs/TECHNICAL_SPECIFICATION.md`

### Experimental Paths
- Keep experimental code (relayer, trade) clearly labeled
- Don't silently promote to production without updating docs and tests

---

## Part 10: AI Agent Instructions

### Before Starting Work
1. Read relevant documentation sections above
2. Understand the existing architecture
3. Check if similar functionality already exists

### During Work
1. Write tests before implementing features
2. Run full test suite after changes
3. Keep changes focused and well-scoped

### Before Declaring Done
1. Verify all tests pass (zero failures, zero skips)
2. Clean up any temporary resources
3. Update documentation if needed
4. Provide evidence of verification in commit/PR

### Communication
- Be explicit about what was changed and why
- Acknowledge limitations or uncertainties
- Ask questions when requirements are unclear

---

*This document should be updated alongside significant codebase changes.*
