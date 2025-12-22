#!/usr/bin/env ts-node
/**
 * Generate addresses.json from Hardhat deployment artifacts
 *
 * Usage:
 *   npx ts-node scripts/generate-addresses.ts --network hardhat
 *   npx ts-node scripts/generate-addresses.ts --network sepolia
 *
 * This script reads deployment artifacts from ignition/deployments/<network>/
 * and updates config/addresses.json with the deployed contract addresses.
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

const CONTRACT_NAMES = [
  "PrivacyPool",
  "Groth16Verifier",
  "PoseidonT3",
  "EntryPoint",
  "SimpleAccountFactory",
  "Paymaster",
];

const NETWORK_METADATA: Record<string, { name: string; rpcUrl: string; explorer: string }> = {
  hardhat: {
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: "",
  },
  sepolia: {
    name: "Sepolia Testnet",
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    explorer: "https://sepolia.etherscan.io",
  },
  mainnet: {
    name: "Ethereum Mainnet",
    rpcUrl: "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
    explorer: "https://etherscan.io",
  },
};

async function loadExistingConfig(): Promise<AddressesConfig> {
  const configPath = path.join(__dirname, "..", "config", "addresses.json");

  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  }

  // Return default config if file doesn't exist
  return {
    networks: {},
  };
}

async function saveConfig(config: AddressesConfig): Promise<void> {
  const configPath = path.join(__dirname, "..", "config", "addresses.json");
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`✅ Saved addresses to ${configPath}`);
}

async function getDeployedAddress(contractName: string, network: string): Promise<string | null> {
  try {
    // Try to get from Hardhat artifacts
    const artifact = await ethers.getContractFactory(contractName);

    // For local network, try to read from deployments
    const deploymentPath = path.join(
      __dirname,
      "..",
      "ignition",
      "deployments",
      network,
      `deployed_addresses.json`
    );

    if (fs.existsSync(deploymentPath)) {
      const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

      // Look for the contract in deployments
      for (const [key, value] of Object.entries(deployments)) {
        if (key.includes(contractName)) {
          return value as string;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(`⚠️  Could not find deployment for ${contractName}: ${(error as Error).message}`);
    return null;
  }
}

async function getDeploymentInfo(
  contractAddress: string,
  network: string
): Promise<{ deployedAt: string; deploymentTx: string } | null> {
  try {
    // For now, return empty values - this would require deployment receipts
    // In a real scenario, you'd read from deployment artifacts
    return {
      deployedAt: "",
      deploymentTx: "",
    };
  } catch (error) {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith("--network="));
  const network = networkArg ? networkArg.split("=")[1] : "hardhat";

  console.log(`🔍 Generating addresses for network: ${network}`);

  // Load existing config
  const config = await loadExistingConfig();

  // Get network info
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const metadata = NETWORK_METADATA[network] || {
    name: `Unknown Network (${network})`,
    rpcUrl: "",
    explorer: "",
  };

  // Initialize network config if it doesn't exist
  if (!config.networks[network]) {
    config.networks[network] = {
      chainId: Number(chainId),
      name: metadata.name,
      contracts: {},
      metadata: {
        rpcUrl: metadata.rpcUrl,
        explorer: metadata.explorer,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  // Update each contract
  for (const contractName of CONTRACT_NAMES) {
    const address = await getDeployedAddress(contractName, network);

    if (address) {
      const deploymentInfo = await getDeploymentInfo(address, network);

      config.networks[network].contracts[contractName] = {
        address,
        deployedAt: deploymentInfo?.deployedAt || "",
        deploymentTx: deploymentInfo?.deploymentTx || "",
        verified: false,
      };

      console.log(`✅ ${contractName}: ${address}`);
    } else {
      // Keep existing entry or create empty one
      if (!config.networks[network].contracts[contractName]) {
        config.networks[network].contracts[contractName] = {
          address: "",
          deployedAt: "",
          deploymentTx: "",
          verified: false,
        };
      }
      console.log(`⚠️  ${contractName}: Not deployed`);
    }
  }

  // Update lastUpdated timestamp
  config.networks[network].metadata.lastUpdated = new Date().toISOString();

  // Save config
  await saveConfig(config);

  console.log(`\n✨ Done! Run 'npx ts-node scripts/validate-addresses.ts --network=${network}' to validate.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error generating addresses:", error);
    process.exit(1);
  });
