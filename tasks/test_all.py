import argparse
import os
import subprocess
import sys


def run(cmd: list[str], cwd: str | None = None) -> int:
    print(f"$ {' '.join(cmd)}" + (f"  (cwd={cwd})" if cwd else ""))
    result = subprocess.run(cmd, cwd=cwd)
    return result.returncode


def test_contracts(scope: str | None = None) -> int:
    # scope can be: unit, integration, e2e or None for all
    env = os.environ.copy()
    # Mocha can filter by grep; we map scope to folder patterns
    if scope in {"unit", "integration", "e2e"}:
        # Use a glob pattern for compatibility across environments
        pattern = os.path.join("test", scope, "**", "*.ts")
        return run(["npx", "hardhat", "test", pattern], cwd=os.getcwd())
    else:
        return run(["npx", "hardhat", "test"], cwd=os.getcwd())


def test_frontend() -> int:
    return run(["npm", "run", "test"], cwd=os.path.join(os.getcwd(), "frontend"))


def test_e2e() -> int:
    return run(["npx", "playwright", "test"], cwd=os.getcwd())


def test_coverage() -> int:
    # Runs solidity-coverage; zk-heavy tests are skipped via SOLIDITY_COVERAGE env
    env = os.environ.copy()
    env["SOLIDITY_COVERAGE"] = "1"
    return subprocess.run(["npx", "hardhat", "coverage"], cwd=os.getcwd(), env=env).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Run project tests")
    parser.add_argument(
        "--contracts",
        choices=["all", "unit", "integration", "e2e"],
        help="Run Hardhat tests (optionally by scope)",
    )
    parser.add_argument("--frontend", action="store_true", help="Run frontend Vitest tests")
    parser.add_argument("--e2e", action="store_true", help="Run Playwright E2E tests")
    parser.add_argument("--coverage", action="store_true", help="Run solidity-coverage")
    args = parser.parse_args()

    exit_code = 0

    if args.contracts:
        code = test_contracts(None if args.contracts == "all" else args.contracts)
        exit_code = exit_code or code

    if args.frontend:
        code = test_frontend()
        exit_code = exit_code or code

    if args.e2e:
        code = test_e2e()
        exit_code = exit_code or code

    if args.coverage:
        code = test_coverage()
        exit_code = exit_code or code

    if not (args.contracts or args.frontend or args.e2e or args.coverage):
        # Default: run contracts (all) then frontend
        if (code := test_contracts()) != 0:
            return code
        if (code := test_frontend()) != 0:
            return code
        # E2E left opt-in because it requires browsers
        print("Skipping Playwright E2E by default. Use --e2e to run.")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
