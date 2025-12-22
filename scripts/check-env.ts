#!/usr/bin/env ts-node
/**
 * Environment Configuration Validation & Secret Detection
 *
 * Usage:
 *   npx ts-node scripts/check-env.ts
 *   npx ts-node scripts/check-env.ts --pre-commit  # For git pre-commit hook
 *
 * Checks:
 * - Required environment variables present
 * - Valid format for addresses, private keys, API keys
 * - No secrets in git-tracked files
 * - No placeholder values in production
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Required environment variables for different contexts
const REQUIRED_FOR_DEPLOYMENT = [
  "DEPLOYER_PRIVATE_KEY",
  "INFURA_API_KEY",
  "ETHERSCAN_API_KEY",
];

const REQUIRED_FOR_FRONTEND = [
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_CHAIN_ID",
];

const SENSITIVE_PATTERNS = [
  { name: "Private Key", pattern: /0x[a-fA-F0-9]{64}/, example: "0x1234...5678" },
  { name: "Mnemonic", pattern: /\b(\w+\s+){11,23}\w+\b/, example: "word1 word2 ... word12" },
  { name: "API Key", pattern: /[a-zA-Z0-9]{32,}/, example: "abc123..." },
];

const PLACEHOLDER_VALUES = [
  "your_infura_api_key_here",
  "your_alchemy_api_key_here",
  "your_etherscan_api_key_here",
  "YOUR_INFURA_KEY",
  "YOUR_API_KEY",
];

function loadEnv(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    throw new Error(`.env file not found. Copy .env.template to .env and configure it.`);
  }

  const envConfig = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
  return envConfig;
}

function validateRequiredVars(
  env: Record<string, string>,
  requiredVars: string[]
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  for (const varName of requiredVars) {
    if (!env[varName] || env[varName].trim() === "") {
      result.errors.push(`Missing required environment variable: ${varName}`);
      result.valid = false;
    } else if (PLACEHOLDER_VALUES.includes(env[varName])) {
      result.errors.push(`${varName} still contains placeholder value: ${env[varName]}`);
      result.valid = false;
    }
  }

  return result;
}

function validatePrivateKey(privateKey: string): boolean {
  // Must be 0x + 64 hex characters
  const regex = /^0x[a-fA-F0-9]{64}$/;
  return regex.test(privateKey);
}

function validateAddress(address: string): boolean {
  // Must be 0x + 40 hex characters
  const regex = /^0x[a-fA-F0-9]{40}$/;
  return regex.test(address);
}

function validateEnvFormat(env: Record<string, string>): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Validate private key format
  if (env.DEPLOYER_PRIVATE_KEY) {
    if (!validatePrivateKey(env.DEPLOYER_PRIVATE_KEY)) {
      result.errors.push("DEPLOYER_PRIVATE_KEY has invalid format (must be 0x + 64 hex chars)");
      result.valid = false;
    }
  }

  // Validate contract addresses
  const addressVars = [
    "NEXT_PUBLIC_PRIVACY_POOL_ADDRESS",
    "NEXT_PUBLIC_VERIFIER_ADDRESS",
    "NEXT_PUBLIC_ENTRY_POINT_ADDRESS",
    "NEXT_PUBLIC_PAYMASTER_ADDRESS",
  ];

  for (const varName of addressVars) {
    if (env[varName] && env[varName] !== "") {
      if (!validateAddress(env[varName])) {
        result.errors.push(`${varName} has invalid address format: ${env[varName]}`);
        result.valid = false;
      }
    }
  }

  // Validate chain ID
  if (env.NEXT_PUBLIC_CHAIN_ID) {
    const chainId = parseInt(env.NEXT_PUBLIC_CHAIN_ID, 10);
    if (isNaN(chainId) || chainId <= 0) {
      result.errors.push(`NEXT_PUBLIC_CHAIN_ID must be a positive number: ${env.NEXT_PUBLIC_CHAIN_ID}`);
      result.valid = false;
    }
  }

  // Validate RPC URLs
  if (env.NEXT_PUBLIC_RPC_URL && !env.NEXT_PUBLIC_RPC_URL.startsWith("http")) {
    result.warnings.push(`NEXT_PUBLIC_RPC_URL should start with http:// or https://`);
  }

  return result;
}

function checkSecretsInGit(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const gitTrackedFiles = [
    ".env",
    "hardhat.config.ts",
    "frontend/.env.local",
    "frontend/.env.production",
  ];

  for (const file of gitTrackedFiles) {
    const filePath = path.join(process.cwd(), file);

    if (fs.existsSync(filePath)) {
      // Check if file is tracked by git
      try {
        const { execSync } = require("child_process");
        const gitStatus = execSync(`git ls-files --error-unmatch "${filePath}" 2>&1`, {
          encoding: "utf-8",
        });

        if (!gitStatus.includes("error")) {
          result.errors.push(`SECURITY: ${file} is tracked by git! Add it to .gitignore immediately.`);
          result.valid = false;
        }
      } catch (error) {
        // File is not tracked - this is good
      }
    }
  }

  return result;
}

function scanForSecrets(filePath: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!fs.existsSync(filePath)) {
    return result;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trim().startsWith("#") || line.trim().startsWith("//")) {
      continue;
    }

    // Check for common secret patterns
    if (line.includes("private") && line.match(/0x[a-fA-F0-9]{64}/)) {
      result.warnings.push(`Line ${i + 1}: Potential private key detected`);
    }

    if (line.match(/mnemonic/i) && line.match(/\b(\w+\s+){11,23}\w+\b/)) {
      result.warnings.push(`Line ${i + 1}: Potential mnemonic phrase detected`);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const preCommitMode = args.includes("--pre-commit");

  console.log("🔍 Checking environment configuration...\n");

  let allValid = true;
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // 1. Check if .env file exists
  try {
    const env = loadEnv();

    // 2. Validate required variables
    const deploymentVars = validateRequiredVars(env, REQUIRED_FOR_DEPLOYMENT);
    allValid = allValid && deploymentVars.valid;
    allErrors.push(...deploymentVars.errors);
    allWarnings.push(...deploymentVars.warnings);

    // 3. Validate format
    const formatCheck = validateEnvFormat(env);
    allValid = allValid && formatCheck.valid;
    allErrors.push(...formatCheck.errors);
    allWarnings.push(...formatCheck.warnings);

    console.log("✅ Environment variables loaded and validated");
  } catch (error) {
    allErrors.push((error as Error).message);
    allValid = false;
  }

  // 4. Check for secrets in git
  const gitCheck = checkSecretsInGit();
  allValid = allValid && gitCheck.valid;
  allErrors.push(...gitCheck.errors);
  allWarnings.push(...gitCheck.warnings);

  if (gitCheck.errors.length === 0) {
    console.log("✅ No secrets detected in git-tracked files");
  }

  // 5. Scan common files for secrets (pre-commit mode)
  if (preCommitMode) {
    const filesToScan = [
      "hardhat.config.ts",
      "frontend/src/config/contracts.ts",
      "scripts/deploy.ts",
    ];

    for (const file of filesToScan) {
      const scanResult = scanForSecrets(file);
      allWarnings.push(...scanResult.warnings);
    }
  }

  // Print results
  console.log();

  if (allErrors.length > 0) {
    console.log("❌ Validation Errors:");
    allErrors.forEach((error) => console.log(`   - ${error}`));
  }

  if (allWarnings.length > 0) {
    console.log("\n⚠️  Validation Warnings:");
    allWarnings.forEach((warning) => console.log(`   - ${warning}`));
  }

  console.log();

  if (allValid && allErrors.length === 0) {
    console.log("✅ Environment configuration is valid!");
    if (allWarnings.length > 0) {
      console.log(`   (${allWarnings.length} warnings - please review)`);
    }
    process.exit(0);
  } else {
    console.log("❌ Environment configuration has errors!");
    console.log(`   ${allErrors.length} errors, ${allWarnings.length} warnings`);
    console.log("\n💡 Quick fix:");
    console.log("   1. Copy .env.template to .env");
    console.log("   2. Fill in your actual values");
    console.log("   3. Ensure .env is in .gitignore");
    console.log("   4. Run this script again");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Error checking environment:", error);
  process.exit(1);
});
