#!/usr/bin/env bash
# Run E2E tests with visual browser for WhisperFi
#
# Usage:
#   ./scripts/run-e2e-visual.sh                    # UI mode (default)
#   ./scripts/run-e2e-visual.sh headed             # Visible browser
#   ./scripts/run-e2e-visual.sh real-zk            # Real ZK proof test
#   ./scripts/run-e2e-visual.sh quick              # Quick mock test
#   ./scripts/run-e2e-visual.sh debug              # Debug mode

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${CYAN}======================================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}======================================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get mode from first argument (default: ui)
MODE="${1:-ui}"

# Check if we're in the correct directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f "$PROJECT_ROOT/frontend/package.json" ]; then
    print_error "Error: Could not find frontend directory"
    print_info "Please run this script from the project root"
    exit 1
fi

print_header "WhisperFi E2E Visual Testing"

# Change to frontend directory
cd "$PROJECT_ROOT/frontend"

# Check if Playwright is installed
print_info "Checking Playwright installation..."
if ! npm list @playwright/test &>/dev/null; then
    print_error "Playwright not installed in frontend/"
    print_info "Installing Playwright..."
    npm install --save-dev @playwright/test
    npx playwright install chromium
fi
print_success "Playwright ready"

# Prepare command based on mode
PLAYWRIGHT_CMD="npx playwright test"
DESCRIPTION=""

case "$MODE" in
    ui)
        PLAYWRIGHT_CMD+=" --ui"
        DESCRIPTION="Interactive Test Explorer"
        print_info "Launching Playwright UI (interactive test explorer)..."
        print_info "Features:"
        print_info "  - Watch tests run in real-time"
        print_info "  - Pause/resume execution"
        print_info "  - Inspect DOM at any point"
        print_info "  - Debug failing tests"
        ;;

    headed)
        PLAYWRIGHT_CMD+=" --headed"
        DESCRIPTION="Visible Browser Mode"
        print_info "Running tests with visible browser..."
        print_info "You will see the browser window and all interactions"
        ;;

    real-zk)
        PLAYWRIGHT_CMD+=" --headed full-flow.real-zk.playwright.ts"
        DESCRIPTION="Real ZK Proof Test (Full Validation)"
        print_header "⚠️  REAL ZK PROOF TEST - SLOW BUT COMPLETE"
        print_info "This test performs:"
        print_info "  1. Start local Hardhat network"
        print_info "  2. Deploy contracts with REAL verifier"
        print_info "  3. Execute deposit transaction"
        print_info "  4. Generate REAL ZK proof (30-60 seconds)"
        print_info "  5. Verify proof on-chain"
        print_info "  6. Execute withdrawal"
        print_info "  7. Verify fund distribution"
        echo ""
        print_info "Expected duration: 60-90 seconds per test"
        print_info "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
        sleep 5
        ;;

    quick)
        PLAYWRIGHT_CMD+=" --workers=1"
        DESCRIPTION="Quick Mock Test"
        print_info "Running quick mock tests (no real ZK proof)..."
        print_info "This is fast but doesn't validate ZK proof generation"
        ;;

    debug)
        PLAYWRIGHT_CMD+=" --debug"
        DESCRIPTION="Step-by-Step Debug Mode"
        print_info "Launching Playwright Inspector..."
        print_info "Features:"
        print_info "  - Pause before each action"
        print_info "  - Step through test line-by-line"
        print_info "  - Explore page state"
        print_info "  - Try commands in console"
        ;;

    *)
        print_error "Unknown mode: $MODE"
        echo ""
        echo "Usage: $0 [mode]"
        echo ""
        echo "Available modes:"
        echo "  ui        - Interactive test explorer (default)"
        echo "  headed    - Visible browser mode"
        echo "  real-zk   - Real ZK proof test (slow but complete)"
        echo "  quick     - Quick mock test"
        echo "  debug     - Step-by-step debug mode"
        exit 1
        ;;
esac

print_header "Starting: $DESCRIPTION"

# Run Playwright
echo -e "${CYAN}Command: $PLAYWRIGHT_CMD${NC}"
echo ""

if $PLAYWRIGHT_CMD; then
    print_success "Tests completed successfully!"
else
    EXIT_CODE=$?
    print_error "Tests failed with exit code $EXIT_CODE"
    print_info "Check the output above for details"
    print_info "Tip: Run with 'debug' mode to step through failing tests"
    exit $EXIT_CODE
fi

print_header "Test session completed"
print_success "Exiting..."
