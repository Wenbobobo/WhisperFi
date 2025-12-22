#!/usr/bin/env npx ts-node
/**
 * WhisperFi Merkle Consistency Verification Script
 *
 * This script verifies that the CircuitCompatibleMerkleTree (frontend) produces
 * the same Merkle root as the on-chain PrivacyPool contract at specified blocks.
 *
 * Usage:
 *   npx ts-node scripts/verify-merkle-consistency.ts --from-block 0 --to-block latest
 *   npx ts-node scripts/verify-merkle-consistency.ts --from-block 100 --to-block 200
 *   npx ts-node scripts/verify-merkle-consistency.ts --rpc-url http://localhost:8545
 */

import { ethers } from "ethers";

// Use require for circomlibjs to avoid TypeScript declaration issues
const circomlibjs = require("circomlibjs");

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

// SNARK scalar field modulus
const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Calculate zero value (must match contract)
const ZERO_VALUE_HEX = (() => {
  const seed = ethers.toUtf8Bytes("PrivacyPool-Zero");
  const hashHex = ethers.keccak256(seed);
  const zeroBigInt = BigInt(hashHex) % SNARK_SCALAR_FIELD;
  return "0x" + zeroBigInt.toString(16).padStart(64, "0");
})();

// PrivacyPool ABI - only the parts we need
const PRIVACY_POOL_ABI = [
  "event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)",
  "function merkleRoot() view returns (bytes32)",
  "function nextLeafIndex() view returns (uint256)",
];

interface VerificationOptions {
  rpcUrl: string;
  contractAddress?: string;
  fromBlock: number | "earliest";
  toBlock: number | "latest";
}

interface BlockCheckpoint {
  blockNumber: number;
  eventCount: number;
  onChainRoot: string;
  frontendRoot: string;
  matches: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<VerificationOptions> {
  const args = process.argv.slice(2);
  const options: Partial<VerificationOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--from-block":
        const fromValue = args[++i];
        options.fromBlock = fromValue === "earliest" ? "earliest" : parseInt(fromValue);
        break;
      case "--to-block":
        const toValue = args[++i];
        options.toBlock = toValue === "latest" ? "latest" : parseInt(toValue);
        break;
      case "--rpc-url":
        options.rpcUrl = args[++i];
        break;
      case "--contract":
        options.contractAddress = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
${colors.bold}WhisperFi Merkle Consistency Verification${colors.reset}

${colors.cyan}Usage:${colors.reset}
  npx ts-node scripts/verify-merkle-consistency.ts [options]

${colors.cyan}Options:${colors.reset}
  --from-block <block>    Starting block number or "earliest" (default: "earliest")
  --to-block <block>      Ending block number or "latest" (default: "latest")
  --rpc-url <url>         RPC endpoint URL (default: http://localhost:8545)
  --contract <address>    PrivacyPool contract address (required)
  --help, -h              Show this help message

${colors.cyan}Examples:${colors.reset}
  # Verify from genesis to latest block
  npx ts-node scripts/verify-merkle-consistency.ts --contract 0x123... --from-block 0 --to-block latest

  # Verify specific block range
  npx ts-node scripts/verify-merkle-consistency.ts --contract 0x123... --from-block 100 --to-block 200

  # Use custom RPC endpoint
  npx ts-node scripts/verify-merkle-consistency.ts --contract 0x123... --rpc-url http://localhost:8545
`);
}

/**
 * Get deposit events in block ranges
 */
async function getDepositEvents(
  contract: ethers.Contract,
  fromBlock: number | "earliest",
  toBlock: number | "latest"
): Promise<ethers.EventLog[]> {
  try {
    const filter = contract.filters.Deposit();
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    return events.filter((e): e is ethers.EventLog => e instanceof ethers.EventLog);
  } catch (error: any) {
    throw new Error(`Failed to fetch deposit events: ${error.message}`);
  }
}

/**
 * Circuit-compatible Merkle Tree implementation
 * Replicates the logic from frontend/src/utils/crypto.ts
 */
class CircuitCompatibleMerkleTree {
  private readonly levels: number;
  private readonly zeroValue: string;
  private readonly leafCount: number;
  private readonly pendingLeaves: string[];
  private poseidon: any;
  private zeros: bigint[] = [];
  private levelNodes: Map<number, bigint>[] = [];
  private nextIndex = 0;
  private root: bigint = 0n;

  constructor(levels: number, leaves: string[], zeroValue: string = "0") {
    this.levels = levels;
    this.zeroValue = zeroValue;
    this.leafCount = leaves.length;
    this.pendingLeaves = [...leaves];
  }

  async initialize(): Promise<void> {
    this.poseidon = await circomlibjs.buildPoseidon();

    this.zeros = new Array(this.levels);
    this.levelNodes = Array.from(
      { length: this.levels + 1 },
      () => new Map<number, bigint>()
    );

    let currentZero = this.toBigInt(this.zeroValue);
    for (let level = 0; level < this.levels; level++) {
      this.zeros[level] = currentZero;
      currentZero = this.hashPair(currentZero, currentZero);
    }

    this.root = currentZero;

    for (const leaf of this.pendingLeaves) {
      this.insertLeaf(this.toBigInt(leaf));
    }
  }

  getRoot(): string {
    return this.toHex(this.root);
  }

  private hashPair(left: bigint, right: bigint): bigint {
    const output = this.poseidon([left, right]);
    return BigInt(this.poseidon.F.toObject(output));
  }

  private insertLeaf(leaf: bigint): void {
    this.levelNodes[0].set(this.nextIndex, leaf);
    let currentIndex = this.nextIndex;
    let currentHash = leaf;

    for (let level = 0; level < this.levels; level++) {
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      const siblingValue =
        this.levelNodes[level].get(siblingIndex) ?? this.zeros[level];

      const left = isRightNode ? siblingValue : currentHash;
      const right = isRightNode ? currentHash : siblingValue;
      currentHash = this.hashPair(left, right);

      const parentIndex = Math.floor(currentIndex / 2);
      this.levelNodes[level + 1].set(parentIndex, currentHash);
      currentIndex = parentIndex;
    }

    this.root = currentHash;
    this.nextIndex += 1;
  }

  private toBigInt(value: string | bigint): bigint {
    if (typeof value === "bigint") {
      return value;
    }
    if (value.startsWith("0x") || value.startsWith("0X")) {
      return BigInt(value);
    }
    return BigInt(value);
  }

  private toHex(value: bigint): string {
    return "0x" + value.toString(16).padStart(64, "0");
  }
}

/**
 * Build frontend Merkle tree from commitments
 */
async function buildFrontendTree(commitments: string[]): Promise<CircuitCompatibleMerkleTree> {
  const tree = new CircuitCompatibleMerkleTree(16, commitments, ZERO_VALUE_HEX);
  await tree.initialize();
  return tree;
}

/**
 * Verify consistency at specific checkpoints
 */
async function verifyConsistency(
  provider: ethers.Provider,
  contract: ethers.Contract,
  events: ethers.EventLog[]
): Promise<BlockCheckpoint[]> {
  const checkpoints: BlockCheckpoint[] = [];

  // Group events by block number
  const eventsByBlock = new Map<number, ethers.EventLog[]>();
  for (const event of events) {
    const blockNum = event.blockNumber;
    if (!eventsByBlock.has(blockNum)) {
      eventsByBlock.set(blockNum, []);
    }
    eventsByBlock.get(blockNum)!.push(event);
  }

  // Sort block numbers
  const blockNumbers = Array.from(eventsByBlock.keys()).sort((a, b) => a - b);

  // Accumulate commitments and verify at each block
  const allCommitments: string[] = [];

  for (const blockNumber of blockNumbers) {
    const blockEvents = eventsByBlock.get(blockNumber)!;

    // Add commitments from this block
    for (const event of blockEvents) {
      const commitment = event.args?.commitment;
      if (commitment) {
        allCommitments.push(commitment);
      }
    }

    // Get on-chain root at this block
    let onChainRoot: string;
    try {
      onChainRoot = await contract.merkleRoot({ blockTag: blockNumber });
    } catch (error: any) {
      console.log(
        `  ${colors.yellow}!${colors.reset} ${colors.dim}Cannot query historical state at block ${blockNumber}: ${error.message}${colors.reset}`
      );
      continue; // Skip blocks where historical state is unavailable
    }

    // Build frontend tree
    const frontendTree = await buildFrontendTree(allCommitments);
    const frontendRoot = frontendTree.getRoot();

    // Check if roots match
    const matches = onChainRoot.toLowerCase() === frontendRoot.toLowerCase();

    checkpoints.push({
      blockNumber,
      eventCount: allCommitments.length,
      onChainRoot,
      frontendRoot,
      matches,
    });
  }

  return checkpoints;
}

/**
 * Print verification report
 */
function printReport(checkpoints: BlockCheckpoint[]): boolean {
  console.log("");
  console.log(
    `${colors.bold}${colors.cyan}=== Merkle Consistency Verification Report ===${colors.reset}`
  );
  console.log("");

  let allPassed = true;

  if (checkpoints.length === 0) {
    console.log(
      `  ${colors.yellow}!${colors.reset} No deposit events found in the specified block range`
    );
    console.log("");
    return true; // No events is not a failure
  }

  console.log(`${colors.bold}Checkpoints Verified: ${checkpoints.length}${colors.reset}`);
  console.log("");

  for (const checkpoint of checkpoints) {
    if (checkpoint.matches) {
      console.log(
        `  ${colors.green}\u2713${colors.reset} Block ${colors.bold}${checkpoint.blockNumber}${colors.reset}: Merkle root matches (${checkpoint.eventCount} deposits)`
      );
      console.log(
        `    ${colors.dim}Root: ${checkpoint.onChainRoot}${colors.reset}`
      );
    } else {
      console.log(
        `  ${colors.red}\u2717${colors.reset} Block ${colors.bold}${checkpoint.blockNumber}${colors.reset}: Merkle root MISMATCH (${checkpoint.eventCount} deposits)`
      );
      console.log(
        `    ${colors.dim}On-chain:  ${checkpoint.onChainRoot}${colors.reset}`
      );
      console.log(
        `    ${colors.dim}Frontend:  ${checkpoint.frontendRoot}${colors.reset}`
      );
      allPassed = false;
    }
  }

  console.log("");
  console.log(`${colors.bold}=== Summary ===${colors.reset}`);

  if (allPassed) {
    console.log(
      `${colors.green}${colors.bold}\u2713 All Merkle roots match on-chain state!${colors.reset}`
    );
  } else {
    console.log(
      `${colors.red}${colors.bold}\u2717 Some Merkle roots do not match on-chain state!${colors.reset}`
    );
    console.log(
      `${colors.yellow}This indicates a bug in the frontend Merkle tree implementation or circuit logic.${colors.reset}`
    );
  }

  console.log("");

  return allPassed;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Parse arguments
    const options = parseArgs();

    // Set defaults
    const rpcUrl = options.rpcUrl || "http://localhost:8545";
    const fromBlock = options.fromBlock ?? "earliest";
    const toBlock = options.toBlock ?? "latest";

    if (!options.contractAddress) {
      console.error(`${colors.red}Error: --contract address is required${colors.reset}`);
      printHelp();
      process.exit(1);
    }

    console.log(`${colors.bold}Configuration:${colors.reset}`);
    console.log(`  RPC URL: ${colors.cyan}${rpcUrl}${colors.reset}`);
    console.log(`  Contract: ${colors.cyan}${options.contractAddress}${colors.reset}`);
    console.log(`  Block Range: ${colors.cyan}${fromBlock} → ${toBlock}${colors.reset}`);
    console.log("");

    // Connect to provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Verify connection
    try {
      await provider.getNetwork();
    } catch (error: any) {
      console.error(`${colors.red}Error: Cannot connect to RPC at ${rpcUrl}${colors.reset}`);
      console.error(`${colors.dim}${error.message}${colors.reset}`);
      process.exit(1);
    }

    // Create contract instance
    const contract = new ethers.Contract(
      options.contractAddress,
      PRIVACY_POOL_ABI,
      provider
    );

    // Fetch deposit events
    console.log(`${colors.dim}Fetching deposit events...${colors.reset}`);
    const events = await getDepositEvents(contract, fromBlock, toBlock);
    console.log(`${colors.dim}Found ${events.length} deposit events${colors.reset}`);

    // Verify consistency
    console.log(`${colors.dim}Verifying Merkle consistency...${colors.reset}`);
    const checkpoints = await verifyConsistency(provider, contract, events);

    // Print report
    const allPassed = printReport(checkpoints);

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  } catch (error: any) {
    console.error(`${colors.red}${colors.bold}Error:${colors.reset} ${error.message}`);
    if (error.stack) {
      console.error(`${colors.dim}${error.stack}${colors.reset}`);
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
