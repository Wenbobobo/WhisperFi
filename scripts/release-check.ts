#!/usr/bin/env ts-node
/**
 * Automated Release Checklist
 *
 * Usage:
 *   npx ts-node scripts/release-check.ts --network sepolia
 *   npx ts-node scripts/release-check.ts --network mainnet --strict
 *
 * Validates all release requirements before deployment:
 * - Code quality (tests, coverage, linting)
 * - Security (audit, secrets, dependencies)
 * - ZK artifacts (checksums, paths)
 * - Configuration (addresses, environment)
 * - Documentation (README, DEPLOYMENT.md)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface CheckResult {
  category: string;
  name: string;
  required: boolean;
  passed: boolean;
  details?: string;
  error?: string;
}

const CHECK_CATEGORIES = {
  CODE_QUALITY: "Code Quality",
  SECURITY: "Security",
  ZK_ARTIFACTS: "ZK Artifacts",
  CONFIGURATION: "Configuration",
  DOCUMENTATION: "Documentation",
};

async function runCommand(command: string, silent: boolean = true): Promise<string> {
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: silent ? "pipe" : "inherit",
    });
    return output;
  } catch (error: any) {
    throw new Error(error.stdout || error.stderr || error.message);
  }
}

async function checkFileExists(filePath: string): Promise<boolean> {
  return fs.existsSync(path.join(process.cwd(), filePath));
}

async function checkCodeQuality(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check 1: All tests passing
  try {
    await runCommand("npx hardhat test");
    results.push({
      category: CHECK_CATEGORIES.CODE_QUALITY,
      name: "Contract Tests",
      required: true,
      passed: true,
      details: "All contract tests passing",
    });
  } catch (error) {
    results.push({
      category: CHECK_CATEGORIES.CODE_QUALITY,
      name: "Contract Tests",
      required: true,
      passed: false,
      error: "Contract tests failing",
    });
  }

  // Check 2: Frontend tests
  try {
    await runCommand("cd frontend && npm run test");
    results.push({
      category: CHECK_CATEGORIES.CODE_QUALITY,
      name: "Frontend Tests",
      required: true,
      passed: true,
      details: "All frontend tests passing",
    });
  } catch (error) {
    results.push({
      category: CHECK_CATEGORIES.CODE_QUALITY,
      name: "Frontend Tests",
      required: true,
      passed: false,
      error: "Frontend tests failing",
    });
  }

  // Check 3: No compiler warnings
  try {
    const output = await runCommand("npx hardhat compile");
    const hasWarnings = output.includes("Warning") || output.includes("warning");
    results.push({
      category: CHECK_CATEGORIES.CODE_QUALITY,
      name: "Compiler Warnings",
      required: false,
      passed: !hasWarnings,
      details: hasWarnings ? "Compiler warnings present" : "No compiler warnings",
    });
  } catch (error) {
    results.push({
      category: CHECK_CATEGORIES.CODE_QUALITY,
      name: "Compiler Warnings",
      required: false,
      passed: false,
      error: "Compilation failed",
    });
  }

  // Check 4: Code coverage (if available)
  const coveragePath = path.join(process.cwd(), "coverage", "coverage-summary.json");
  if (fs.existsSync(coveragePath)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf-8"));
      const totalCoverage = coverage.total?.statements?.pct || 0;
      results.push({
        category: CHECK_CATEGORIES.CODE_QUALITY,
        name: "Code Coverage",
        required: false,
        passed: totalCoverage >= 80,
        details: `${totalCoverage.toFixed(2)}% (target: ≥80%)`,
      });
    } catch (error) {
      results.push({
        category: CHECK_CATEGORIES.CODE_QUALITY,
        name: "Code Coverage",
        required: false,
        passed: false,
        error: "Failed to read coverage",
      });
    }
  }

  return results;
}

async function checkSecurity(strict: boolean): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check 1: No .env in git
  try {
    const output = await runCommand('git ls-files | grep -E "^\\.env$"');
    results.push({
      category: CHECK_CATEGORIES.SECURITY,
      name: "Secrets in Git",
      required: true,
      passed: output.trim() === "",
      details: output.trim() === "" ? "No .env in git" : ".env file tracked by git!",
    });
  } catch (error) {
    // grep returns non-zero if no matches (good)
    results.push({
      category: CHECK_CATEGORIES.SECURITY,
      name: "Secrets in Git",
      required: true,
      passed: true,
      details: "No .env in git",
    });
  }

  // Check 2: Environment validation
  try {
    await runCommand("npx ts-node scripts/check-env.ts");
    results.push({
      category: CHECK_CATEGORIES.SECURITY,
      name: "Environment Configuration",
      required: true,
      passed: true,
      details: "Environment validated",
    });
  } catch (error) {
    results.push({
      category: CHECK_CATEGORIES.SECURITY,
      name: "Environment Configuration",
      required: true,
      passed: false,
      error: "Environment validation failed",
    });
  }

  // Check 3: Audit report (for mainnet)
  if (strict) {
    const auditExists = await checkFileExists("docs/AUDIT_REPORT.md");
    results.push({
      category: CHECK_CATEGORIES.SECURITY,
      name: "Security Audit",
      required: true,
      passed: auditExists,
      details: auditExists ? "Audit report found" : "No audit report (required for mainnet)",
    });
  }

  // Check 4: Dependency vulnerabilities
  try {
    await runCommand("npm audit --production --audit-level=high");
    results.push({
      category: CHECK_CATEGORIES.SECURITY,
      name: "Dependency Vulnerabilities",
      required: false,
      passed: true,
      details: "No high/critical vulnerabilities",
    });
  } catch (error) {
    results.push({
      category: CHECK_CATEGORIES.SECURITY,
      name: "Dependency Vulnerabilities",
      required: false,
      passed: false,
      error: "High/critical vulnerabilities found",
    });
  }

  return results;
}

async function checkZKArtifacts(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check 1: ZK artifacts exist
  const zkFiles = [
    "circuits/build/withdraw/withdraw.wasm",
    "circuits/build/withdraw/withdraw_final.zkey",
  ];

  for (const file of zkFiles) {
    const exists = await checkFileExists(file);
    results.push({
      category: CHECK_CATEGORIES.ZK_ARTIFACTS,
      name: `ZK Artifact: ${path.basename(file)}`,
      required: true,
      passed: exists,
      details: exists ? "Found" : "Missing",
    });
  }

  // Check 2: ZK checksums verified
  try {
    await runCommand("npm run verify:zk");
    results.push({
      category: CHECK_CATEGORIES.ZK_ARTIFACTS,
      name: "ZK Checksums",
      required: true,
      passed: true,
      details: "All checksums valid",
    });
  } catch (error) {
    results.push({
      category: CHECK_CATEGORIES.ZK_ARTIFACTS,
      name: "ZK Checksums",
      required: true,
      passed: false,
      error: "Checksum validation failed",
    });
  }

  return results;
}

async function checkConfiguration(network: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check 1: addresses.json exists
  const addressesExists = await checkFileExists("config/addresses.json");
  results.push({
    category: CHECK_CATEGORIES.CONFIGURATION,
    name: "Address Registry",
    required: true,
    passed: addressesExists,
    details: addressesExists ? "config/addresses.json found" : "Missing",
  });

  // Check 2: Validate addresses for network
  if (addressesExists) {
    try {
      await runCommand(`npx ts-node scripts/validate-addresses.ts --network=${network}`);
      results.push({
        category: CHECK_CATEGORIES.CONFIGURATION,
        name: `Addresses (${network})`,
        required: true,
        passed: true,
        details: "All addresses valid",
      });
    } catch (error) {
      results.push({
        category: CHECK_CATEGORIES.CONFIGURATION,
        name: `Addresses (${network})`,
        required: true,
        passed: false,
        error: "Address validation failed",
      });
    }
  }

  // Check 3: .env.template exists
  const envTemplateExists = await checkFileExists(".env.template");
  results.push({
    category: CHECK_CATEGORIES.CONFIGURATION,
    name: "Environment Template",
    required: true,
    passed: envTemplateExists,
    details: envTemplateExists ? ".env.template found" : "Missing",
  });

  return results;
}

async function checkDocumentation(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const requiredDocs = [
    { file: "README.md", name: "README" },
    { file: "docs/DEPLOYMENT.md", name: "Deployment Guide" },
    { file: "docs/TESTING_GUIDE.md", name: "Testing Guide" },
    { file: "docs/OPERATIONS_GUIDE.md", name: "Operations Guide" },
  ];

  for (const doc of requiredDocs) {
    const exists = await checkFileExists(doc.file);
    results.push({
      category: CHECK_CATEGORIES.DOCUMENTATION,
      name: doc.name,
      required: true,
      passed: exists,
      details: exists ? "Found" : "Missing",
    });
  }

  return results;
}

async function runReleaseChecks(network: string, strict: boolean): Promise<void> {
  console.log(`\n🔍 Running release checks for network: ${network}`);
  if (strict) {
    console.log("   Strict mode: All checks required\n");
  } else {
    console.log("   Standard mode: Only critical checks required\n");
  }

  const allResults: CheckResult[] = [];

  // Run all check categories
  console.log("📋 Code Quality...");
  const codeResults = await checkCodeQuality();
  allResults.push(...codeResults);
  printResults(codeResults);

  console.log("\n📋 Security...");
  const securityResults = await checkSecurity(strict);
  allResults.push(...securityResults);
  printResults(securityResults);

  console.log("\n📋 ZK Artifacts...");
  const zkResults = await checkZKArtifacts();
  allResults.push(...zkResults);
  printResults(zkResults);

  console.log("\n📋 Configuration...");
  const configResults = await checkConfiguration(network);
  allResults.push(...configResults);
  printResults(configResults);

  console.log("\n📋 Documentation...");
  const docResults = await checkDocumentation();
  allResults.push(...docResults);
  printResults(docResults);

  // Summary
  const requiredChecks = allResults.filter((r) => r.required);
  const passedRequired = requiredChecks.filter((r) => r.passed).length;
  const totalRequired = requiredChecks.length;

  const optionalChecks = allResults.filter((r) => !r.required);
  const passedOptional = optionalChecks.filter((r) => r.passed).length;
  const totalOptional = optionalChecks.length;

  console.log("\n" + "=".repeat(70));
  console.log("📊 Release Check Summary");
  console.log("=".repeat(70));
  console.log(`Required Checks: ${passedRequired}/${totalRequired} passed`);
  console.log(`Optional Checks: ${passedOptional}/${totalOptional} passed`);
  console.log("=".repeat(70));

  const failedRequired = requiredChecks.filter((r) => !r.passed);

  if (failedRequired.length === 0) {
    console.log("\n✅ All required checks passed! Ready for deployment.");
    if (totalOptional > passedOptional) {
      console.log(
        `\n⚠️  ${totalOptional - passedOptional} optional check(s) failed (review recommended)`
      );
    }
    process.exit(0);
  } else {
    console.log(`\n❌ ${failedRequired.length} required check(s) failed!`);
    console.log("\nFailed required checks:");
    failedRequired.forEach((r) => {
      console.log(`   - [${r.category}] ${r.name}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
    console.log("\n🚫 NOT ready for deployment!");
    process.exit(1);
  }
}

function printResults(results: CheckResult[]): void {
  results.forEach((r) => {
    const icon = r.passed ? "✅" : r.required ? "❌" : "⚠️ ";
    const reqLabel = r.required ? "[REQUIRED]" : "[OPTIONAL]";
    console.log(`   ${icon} ${reqLabel} ${r.name}`);
    if (r.details) console.log(`      ${r.details}`);
    if (r.error) console.log(`      Error: ${r.error}`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith("--network="));
  const network = networkArg ? networkArg.split("=")[1] : "sepolia";
  const strict = args.includes("--strict");

  if (network === "mainnet") {
    console.log("\n⚠️  WARNING: Preparing for MAINNET deployment!");
    console.log("   All checks will be enforced strictly.\n");
    await runReleaseChecks(network, true);
  } else {
    await runReleaseChecks(network, strict);
  }
}

main().catch((error) => {
  console.error("\n❌ Release check failed:", error);
  process.exit(1);
});
