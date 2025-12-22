#!/usr/bin/env ts-node
/**
 * Validate addresses.json for correctness and completeness
 *
 * Usage:
 *   npx ts-node scripts/validate-addresses.ts --network hardhat
 *   npx ts-node scripts/validate-addresses.ts --network sepolia --strict
 *
 * Checks:
 * - Valid Ethereum addresses (0x + 40 hex chars)
 * - Valid transaction hashes (0x + 64 hex chars)
 * - All required contracts present
 * - Network metadata complete
 * - Optional: Contract code verification (--strict mode)
 */

import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

interface ContractInfo {
  address: string;
  deployedAt: string;
  deploymentTx: string;
  verified: boolean;
  note?: string;
}

interface NetworkConfig {
  chainId: number;
  name: string;
  contracts: Record<string, ContractInfo>;
  metadata: {
    rpcUrl: string;
    explorer: string;
    lastUpdated: string;
  };
}

interface AddressesConfig {
  networks: Record<string, NetworkConfig>;
}

const REQUIRED_CONTRACTS = [
  "PrivacyPool",
  "Groth16Verifier",
  "PoseidonT3",
  "EntryPoint",
  "SimpleAccountFactory",
  "Paymaster",
];

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateAddress(address: string): boolean {
  return ADDRESS_REGEX.test(address);
}

function validateTxHash(txHash: string): boolean {
  return TX_HASH_REGEX.test(txHash);
}

function loadConfig(): AddressesConfig {
  const configPath = path.join(__dirname, "..", "config", "addresses.json");

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(content);
}

async function validateNetworkConfig(
  networkName: string,
  config: NetworkConfig,
  strict: boolean
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Validate chain ID
  if (!config.chainId || typeof config.chainId !== "number") {
    result.errors.push(`Missing or invalid chainId for network ${networkName}`);
    result.valid = false;
  }

  // Validate metadata
  if (!config.metadata) {
    result.errors.push(`Missing metadata for network ${networkName}`);
    result.valid = false;
  } else {
    if (!config.metadata.rpcUrl) {
      result.warnings.push(`Missing RPC URL for network ${networkName}`);
    }
    if (!config.metadata.explorer && networkName !== "hardhat") {
      result.warnings.push(`Missing explorer URL for network ${networkName}`);
    }
  }

  // Validate required contracts
  for (const contractName of REQUIRED_CONTRACTS) {
    const contract = config.contracts[contractName];

    if (!contract) {
      result.errors.push(`Missing contract ${contractName} in network ${networkName}`);
      result.valid = false;
      continue;
    }

    // Check if address is empty (allowed for undeployed contracts)
    if (!contract.address || contract.address === "") {
      result.warnings.push(`Contract ${contractName} has no address (not deployed?)`);
      continue;
    }

    // Validate address format
    if (!validateAddress(contract.address)) {
      result.errors.push(`Invalid address for ${contractName}: ${contract.address}`);
      result.valid = false;
    }

    // Validate deployment tx (if present)
    if (contract.deploymentTx && contract.deploymentTx !== "" && !validateTxHash(contract.deploymentTx)) {
      result.errors.push(`Invalid deployment tx for ${contractName}: ${contract.deploymentTx}`);
      result.valid = false;
    }

    // Strict mode: verify contract code exists
    if (strict && contract.address) {
      try {
        const code = await ethers.provider.getCode(contract.address);
        if (code === "0x") {
          result.errors.push(`Contract ${contractName} has no code at address ${contract.address}`);
          result.valid = false;
        } else {
          console.log(`  ✅ ${contractName}: Code verified at ${contract.address}`);
        }
      } catch (error) {
        result.errors.push(`Failed to verify code for ${contractName}: ${(error as Error).message}`);
        result.valid = false;
      }
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith("--network="));
  const network = networkArg ? networkArg.split("=")[1] : "hardhat";
  const strict = args.includes("--strict");

  console.log(`🔍 Validating addresses for network: ${network}`);
  if (strict) {
    console.log(`   Strict mode: will verify contract code on-chain\n`);
  }

  // Load config
  const config = loadConfig();

  // Check if network exists
  if (!config.networks[network]) {
    console.error(`❌ Network ${network} not found in config`);
    process.exit(1);
  }

  // Validate network config
  const result = await validateNetworkConfig(network, config.networks[network], strict);

  // Print results
  if (result.errors.length > 0) {
    console.log("\n❌ Validation Errors:");
    result.errors.forEach((error) => console.log(`   - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️  Validation Warnings:");
    result.warnings.forEach((warning) => console.log(`   - ${warning}`));
  }

  if (result.valid && result.errors.length === 0) {
    console.log("\n✅ Validation passed!");
    if (result.warnings.length > 0) {
      console.log(`   (${result.warnings.length} warnings)`);
    }
    process.exit(0);
  } else {
    console.log("\n❌ Validation failed!");
    console.log(`   ${result.errors.length} errors, ${result.warnings.length} warnings`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Error validating addresses:", error);
  process.exit(1);
});
