#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run E2E tests with visual browser for WhisperFi

.DESCRIPTION
    Convenient script to run Playwright E2E tests with different modes:
    - Visual UI mode (interactive test explorer)
    - Headed mode (visible browser)
    - Real ZK proof tests
    - Quick mock tests

.PARAMETER Mode
    Test mode: ui, headed, real-zk, quick (default: ui)

.PARAMETER Test
    Specific test file to run (optional)

.EXAMPLE
    .\scripts\run-e2e-visual.ps1
    # Runs UI mode (interactive explorer)

.EXAMPLE
    .\scripts\run-e2e-visual.ps1 -Mode headed
    # Runs with visible browser

.EXAMPLE
    .\scripts\run-e2e-visual.ps1 -Mode real-zk
    # Runs real ZK proof test (slow but complete validation)

.EXAMPLE
    .\scripts\run-e2e-visual.ps1 -Mode quick -Test withdraw.fee-flow.playwright.ts
    # Runs specific test file quickly
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("ui", "headed", "real-zk", "quick", "debug")]
    [string]$Mode = "ui",

    [Parameter(Mandatory=$false)]
    [string]$Test = ""
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-ColorOutput $Message -Color Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "✅ $Message" -Color Green
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "ℹ️  $Message" -Color Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-ColorOutput "❌ $Message" -Color Red
}

# Check if we're in the correct directory
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\frontend\package.json")) {
    Write-Error-Custom "Error: Could not find frontend directory"
    Write-Info "Please run this script from the project root"
    exit 1
}

Write-Header "WhisperFi E2E Visual Testing"

# Change to frontend directory
Push-Location "$projectRoot\frontend"

try {
    # Check if Playwright is installed
    Write-Info "Checking Playwright installation..."
    $playwrightCheck = & npm list @playwright/test 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Playwright not installed in frontend/"
        Write-Info "Installing Playwright..."
        npm install --save-dev @playwright/test
        npx playwright install chromium
    }
    Write-Success "Playwright ready"

    # Prepare command based on mode
    $playwrightCmd = "npx playwright test"
    $description = ""

    switch ($Mode) {
        "ui" {
            $playwrightCmd += " --ui"
            $description = "Interactive Test Explorer"
            Write-Info "Launching Playwright UI (interactive test explorer)..."
            Write-Info "Features:"
            Write-Info "  - Watch tests run in real-time"
            Write-Info "  - Pause/resume execution"
            Write-Info "  - Inspect DOM at any point"
            Write-Info "  - Debug failing tests"
        }

        "headed" {
            $playwrightCmd += " --headed"
            $description = "Visible Browser Mode"
            Write-Info "Running tests with visible browser..."
            Write-Info "You will see the browser window and all interactions"
        }

        "real-zk" {
            $playwrightCmd += " --headed full-flow.real-zk.playwright.ts"
            $description = "Real ZK Proof Test (Full Validation)"
            Write-Header "⚠️  REAL ZK PROOF TEST - SLOW BUT COMPLETE"
            Write-Info "This test performs:"
            Write-Info "  1. Start local Hardhat network"
            Write-Info "  2. Deploy contracts with REAL verifier"
            Write-Info "  3. Execute deposit transaction"
            Write-Info "  4. Generate REAL ZK proof (30-60 seconds)"
            Write-Info "  5. Verify proof on-chain"
            Write-Info "  6. Execute withdrawal"
            Write-Info "  7. Verify fund distribution"
            Write-Info ""
            Write-Info "Expected duration: 60-90 seconds per test"
            Write-Info "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
            Start-Sleep -Seconds 5
        }

        "quick" {
            $playwrightCmd += " --workers=1"
            $description = "Quick Mock Test"
            Write-Info "Running quick mock tests (no real ZK proof)..."
            Write-Info "This is fast but doesn't validate ZK proof generation"
        }

        "debug" {
            $playwrightCmd += " --debug"
            $description = "Step-by-Step Debug Mode"
            Write-Info "Launching Playwright Inspector..."
            Write-Info "Features:"
            Write-Info "  - Pause before each action"
            Write-Info "  - Step through test line-by-line"
            Write-Info "  - Explore page state"
            Write-Info "  - Try commands in console"
        }
    }

    # Add specific test file if provided
    if ($Test -ne "") {
        $playwrightCmd += " $Test"
        Write-Info "Running specific test: $Test"
    }

    Write-Header "Starting: $description"

    # Run Playwright
    Write-ColorOutput "Command: $playwrightCmd" -Color DarkGray
    Write-Host ""

    Invoke-Expression $playwrightCmd

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Tests completed successfully!"
    } else {
        Write-Error-Custom "Tests failed with exit code $LASTEXITCODE"
        Write-Info "Check the output above for details"
        Write-Info "Tip: Run with -Mode debug to step through failing tests"
        exit $LASTEXITCODE
    }

} catch {
    Write-Error-Custom "An error occurred: $_"
    exit 1
} finally {
    # Return to original directory
    Pop-Location
}

Write-Header "Test session completed"
Write-Success "Exiting..."
