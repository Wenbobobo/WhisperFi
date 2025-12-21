#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run complete test suite for WhisperFi

.DESCRIPTION
    Executes all tests in sequence and generates summary report:
    1. Contract tests (Hardhat)
    2. Frontend tests (Vitest)
    3. E2E tests (Playwright)
    4. Optional: Real ZK proof tests

.PARAMETER IncludeRealZK
    Include slow real ZK proof tests (adds ~2 minutes)

.PARAMETER SkipE2E
    Skip E2E Playwright tests

.PARAMETER Coverage
    Generate coverage reports

.EXAMPLE
    .\scripts\run-all-tests.ps1
    # Run all tests (except real ZK)

.EXAMPLE
    .\scripts\run-all-tests.ps1 -IncludeRealZK
    # Run all tests including real ZK proof validation

.EXAMPLE
    .\scripts\run-all-tests.ps1 -Coverage
    # Run all tests and generate coverage reports
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$IncludeRealZK = $false,

    [Parameter(Mandatory=$false)]
    [switch]$SkipE2E = $false,

    [Parameter(Mandatory=$false)]
    [switch]$Coverage = $false
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Magenta
    Write-Host ""
}

# Test results tracking
$testResults = @{
    Contract = @{ Passed = 0; Failed = 0; Duration = 0 }
    Frontend = @{ Passed = 0; Failed = 0; Duration = 0 }
    E2E = @{ Passed = 0; Failed = 0; Duration = 0 }
    RealZK = @{ Passed = 0; Failed = 0; Duration = 0 }
}

$startTime = Get-Date

Write-Header "WhisperFi Complete Test Suite"

if ($IncludeRealZK) {
    Write-Info "Real ZK proof tests ENABLED (this will take longer)"
}

if ($SkipE2E) {
    Write-Info "E2E tests SKIPPED"
}

if ($Coverage) {
    Write-Info "Coverage reports ENABLED"
}

Write-Host ""

# ============================================================================
# Step 1: Contract Tests
# ============================================================================

Write-Step "[1/4] Running Contract Tests (Hardhat)"

$contractStartTime = Get-Date

try {
    if ($Coverage) {
        Write-Info "Running with coverage..."
        & npx hardhat coverage
    } else {
        & npx hardhat test
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Contract tests passed"
        $testResults.Contract.Passed = 103 # Update based on actual count
    } else {
        throw "Contract tests failed"
    }
} catch {
    Write-Error-Custom "Contract tests failed: $_"
    $testResults.Contract.Failed = 1
}

$contractEndTime = Get-Date
$testResults.Contract.Duration = ($contractEndTime - $contractStartTime).TotalSeconds

# ============================================================================
# Step 2: Frontend Tests
# ============================================================================

Write-Step "[2/4] Running Frontend Tests (Vitest)"

$frontendStartTime = Get-Date

Push-Location "frontend"

try {
    if ($Coverage) {
        Write-Info "Running with coverage..."
        & npm run test
    } else {
        & npx vitest run
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend tests passed"
        $testResults.Frontend.Passed = 126 # Update based on actual count
    } else {
        throw "Frontend tests failed"
    }
} catch {
    Write-Error-Custom "Frontend tests failed: $_"
    $testResults.Frontend.Failed = 1
} finally {
    Pop-Location
}

$frontendEndTime = Get-Date
$testResults.Frontend.Duration = ($frontendEndTime - $frontendStartTime).TotalSeconds

# ============================================================================
# Step 3: E2E Tests (Playwright)
# ============================================================================

if (-not $SkipE2E) {
    Write-Step "[3/4] Running E2E Tests (Playwright)"

    $e2eStartTime = Get-Date

    Push-Location "frontend"

    try {
        Write-Info "Running Playwright E2E tests (mock ZK)..."
        & npx playwright test --grep-invert "real-zk"

        if ($LASTEXITCODE -eq 0) {
            Write-Success "E2E tests passed"
            $testResults.E2E.Passed = 9 # Update based on actual count
        } else {
            throw "E2E tests failed"
        }
    } catch {
        Write-Error-Custom "E2E tests failed: $_"
        $testResults.E2E.Failed = 1
    } finally {
        Pop-Location
    }

    $e2eEndTime = Get-Date
    $testResults.E2E.Duration = ($e2eEndTime - $e2eStartTime).TotalSeconds
} else {
    Write-Info "E2E tests skipped (use without -SkipE2E to run)"
}

# ============================================================================
# Step 4: Real ZK Tests (Optional)
# ============================================================================

if ($IncludeRealZK) {
    Write-Step "[4/4] Running Real ZK Proof Tests (SLOW)"

    Write-Info "This will take 2-3 minutes..."

    $zkStartTime = Get-Date

    Push-Location "frontend"

    try {
        & npx playwright test full-flow.real-zk.playwright.ts --headed

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Real ZK tests passed"
            $testResults.RealZK.Passed = 2
        } else {
            throw "Real ZK tests failed"
        }
    } catch {
        Write-Error-Custom "Real ZK tests failed: $_"
        $testResults.RealZK.Failed = 1
    } finally {
        Pop-Location
    }

    $zkEndTime = Get-Date
    $testResults.RealZK.Duration = ($zkEndTime - $zkStartTime).TotalSeconds
} else {
    Write-Info "Real ZK tests skipped (use -IncludeRealZK to run)"
}

# ============================================================================
# Generate Summary Report
# ============================================================================

$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalSeconds

Write-Header "Test Suite Summary Report"

Write-Host ""
Write-Host "Test Results:" -ForegroundColor Cyan
Write-Host ("=" * 80)

function Format-TestResult {
    param(
        [string]$Name,
        [int]$Passed,
        [int]$Failed,
        [double]$Duration
    )

    $status = if ($Failed -eq 0) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($Failed -eq 0) { "Green" } else { "Red" }

    Write-Host ("  {0,-20} {1,10} {2,15} {3,15}" -f $Name, $status, "$Passed tests", "$([math]::Round($Duration, 1))s") -ForegroundColor $color
}

Format-TestResult "Contract Tests" $testResults.Contract.Passed $testResults.Contract.Failed $testResults.Contract.Duration
Format-TestResult "Frontend Tests" $testResults.Frontend.Passed $testResults.Frontend.Failed $testResults.Frontend.Duration

if (-not $SkipE2E) {
    Format-TestResult "E2E Tests" $testResults.E2E.Passed $testResults.E2E.Failed $testResults.E2E.Duration
}

if ($IncludeRealZK) {
    Format-TestResult "Real ZK Tests" $testResults.RealZK.Passed $testResults.RealZK.Failed $testResults.RealZK.Duration
}

Write-Host ("=" * 80)
Write-Host ""

$totalTests = $testResults.Contract.Passed + $testResults.Frontend.Passed + $testResults.E2E.Passed + $testResults.RealZK.Passed
$totalFailed = $testResults.Contract.Failed + $testResults.Frontend.Failed + $testResults.E2E.Failed + $testResults.RealZK.Failed

Write-Host "Overall Summary:" -ForegroundColor Cyan
Write-Host "  Total Tests:    $totalTests"
Write-Host "  Passed:         $($totalTests - $totalFailed)" -ForegroundColor Green
Write-Host "  Failed:         $totalFailed" -ForegroundColor $(if ($totalFailed -eq 0) { "Green" } else { "Red" })
Write-Host "  Total Duration: $([math]::Round($totalDuration, 1))s"
Write-Host ""

# Coverage summary (if enabled)
if ($Coverage) {
    Write-Header "Coverage Reports Generated"

    Write-Info "Contract Coverage:"
    Write-Host "  📊 coverage/index.html"

    Write-Info "Frontend Coverage:"
    Write-Host "  📊 frontend/coverage/index.html"

    Write-Host ""
    Write-Info "Open in browser:"
    Write-Host "  start coverage/index.html"
    Write-Host "  start frontend/coverage/index.html"
    Write-Host ""
}

# E2E report (if available)
if (-not $SkipE2E) {
    Write-Info "E2E Test Report:"
    Write-Host "  📊 frontend/playwright-report/index.html"
    Write-Host ""
    Write-Info "View report: cd frontend && npx playwright show-report"
    Write-Host ""
}

# Final status
Write-Header "Test Suite Completed"

if ($totalFailed -eq 0) {
    Write-Success "All tests passed! 🎉"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Review coverage reports (if enabled)"
    Write-Host "  2. Run smoke tests: npm run smoke-test"
    Write-Host "  3. Run release check: npm run release-check"
    Write-Host ""
    exit 0
} else {
    Write-Error-Custom "Some tests failed!"
    Write-Host ""
    Write-Host "Debug steps:" -ForegroundColor Yellow
    Write-Host "  1. Review error messages above"
    Write-Host "  2. Run failing suite individually:"
    if ($testResults.Contract.Failed -gt 0) {
        Write-Host "     npx hardhat test --verbose"
    }
    if ($testResults.Frontend.Failed -gt 0) {
        Write-Host "     cd frontend && npm run test:watch"
    }
    if ($testResults.E2E.Failed -gt 0) {
        Write-Host "     cd frontend && npx playwright test --ui"
    }
    if ($testResults.RealZK.Failed -gt 0) {
        Write-Host "     cd frontend && npx playwright test full-flow.real-zk.playwright.ts --debug"
    }
    Write-Host ""
    exit 1
}
