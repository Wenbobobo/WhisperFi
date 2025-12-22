#!/usr/bin/env npx ts-node
/**
 * WhisperFi Merkle Tree Rebuild Performance Benchmark
 *
 * This script measures the performance of rebuilding the Merkle tree from deposit events,
 * recording replay time, event count, and peak memory usage.
 *
 * Usage:
 *   npx ts-node test/benchmark/merkle-rebuild.bench.ts
 *   npx ts-node test/benchmark/merkle-rebuild.bench.ts --sizes 10,100,1000
 *   npx ts-node test/benchmark/merkle-rebuild.bench.ts --iterations 10
 */

// Use require for circomlibjs to avoid TypeScript declaration issues
const circomlibjs = require("circomlibjs");
const { ethers } = require("ethers");

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
 * Generate random commitments for testing
 */
function generateRandomCommitments(count: number): string[] {
  const commitments: string[] = [];
  for (let i = 0; i < count; i++) {
    const commitment = ethers.hexlify(ethers.randomBytes(32));
    commitments.push(commitment);
  }
  return commitments;
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsageMB(): number {
  const used = process.memoryUsage();
  return Math.round(used.heapUsed / 1024 / 1024 * 100) / 100;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Run benchmark for a specific event count
 */
async function benchmarkSize(
  eventCount: number,
  iterations: number
): Promise<{
  eventCount: number;
  iterations: number;
  timesMs: number[];
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  peakMemoryMB: number;
}> {
  const timesMs: number[] = [];
  let peakMemoryMB = 0;

  // Generate commitments once for all iterations
  const commitments = generateRandomCommitments(eventCount);

  for (let i = 0; i < iterations; i++) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const startMemory = getMemoryUsageMB();
    const startTime = Date.now();

    // Build Merkle tree
    const tree = new CircuitCompatibleMerkleTree(16, commitments, ZERO_VALUE_HEX);
    await tree.initialize();
    const root = tree.getRoot();

    const endTime = Date.now();
    const endMemory = getMemoryUsageMB();

    const elapsedMs = endTime - startTime;
    const memoryUsedMB = endMemory - startMemory;

    timesMs.push(elapsedMs);
    peakMemoryMB = Math.max(peakMemoryMB, memoryUsedMB);

    // Log progress for large iterations
    if (iterations > 5 && (i + 1) % Math.ceil(iterations / 5) === 0) {
      console.log(
        `  ${colors.dim}Progress: ${i + 1}/${iterations} iterations (${Math.round(((i + 1) / iterations) * 100)}%)${colors.reset}`
      );
    }
  }

  return {
    eventCount,
    iterations,
    timesMs,
    p50Ms: percentile(timesMs, 50),
    p95Ms: percentile(timesMs, 95),
    p99Ms: percentile(timesMs, 99),
    avgMs: timesMs.reduce((a, b) => a + b, 0) / timesMs.length,
    minMs: Math.min(...timesMs),
    maxMs: Math.max(...timesMs),
    peakMemoryMB,
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): { sizes: number[]; iterations: number; output?: string } {
  const args = process.argv.slice(2);
  let sizes = [10, 50, 100, 500, 1000];
  let iterations = 5;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--sizes":
        sizes = args[++i].split(",").map(Number);
        break;
      case "--iterations":
        iterations = parseInt(args[++i]);
        break;
      case "--output":
        output = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return { sizes, iterations, output };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
${colors.bold}WhisperFi Merkle Tree Rebuild Benchmark${colors.reset}

${colors.cyan}Usage:${colors.reset}
  npx ts-node test/benchmark/merkle-rebuild.bench.ts [options]

${colors.cyan}Options:${colors.reset}
  --sizes <sizes>        Comma-separated list of event counts to benchmark (default: 10,50,100,500,1000)
  --iterations <n>       Number of iterations per size (default: 5)
  --output <file>        Save results to markdown file (default: docs/BENCHMARKS.md)
  --help, -h             Show this help message

${colors.cyan}Examples:${colors.reset}
  # Run default benchmark
  npx ts-node test/benchmark/merkle-rebuild.bench.ts

  # Benchmark specific sizes with more iterations
  npx ts-node test/benchmark/merkle-rebuild.bench.ts --sizes 100,1000,10000 --iterations 10

  # Save results to custom file
  npx ts-node test/benchmark/merkle-rebuild.bench.ts --output custom-results.md

${colors.cyan}Note:${colors.reset}
  For accurate memory measurements, run with --expose-gc flag:
  node --expose-gc node_modules/.bin/ts-node test/benchmark/merkle-rebuild.bench.ts
`);
}

/**
 * Format benchmark results as markdown
 */
function formatMarkdown(results: any[]): string {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);

  let markdown = `# WhisperFi Merkle Tree Rebuild Benchmarks

> Auto-generated by \`merkle-rebuild.bench.ts\`
> Last updated: ${now} UTC

## System Information

- **Node Version**: ${process.version}
- **Platform**: ${process.platform}
- **Architecture**: ${process.arch}
- **CPU**: ${require("os").cpus()[0].model}
- **Memory**: ${Math.round(require("os").totalmem() / 1024 / 1024 / 1024)} GB

## Benchmark Results

| Event Count | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Min (ms) | Max (ms) | Peak Memory (MB) | Iterations |
|-------------|----------|----------|----------|----------|----------|----------|------------------|------------|
`;

  for (const result of results) {
    markdown += `| ${result.eventCount.toLocaleString()} | ${result.p50Ms.toFixed(2)} | ${result.p95Ms.toFixed(2)} | ${result.p99Ms.toFixed(2)} | ${result.avgMs.toFixed(2)} | ${result.minMs.toFixed(2)} | ${result.maxMs.toFixed(2)} | ${result.peakMemoryMB.toFixed(2)} | ${result.iterations} |\n`;
  }

  markdown += `
## Interpretation

### Replay Time

- **P50 (Median)**: Half of the rebuilds complete faster than this time
- **P95**: 95% of rebuilds complete faster than this time
- **P99**: 99% of rebuilds complete faster than this time

### Performance Characteristics

`;

  // Calculate growth rate
  if (results.length >= 2) {
    const firstResult = results[0];
    const lastResult = results[results.length - 1];
    const timeGrowth =
      (lastResult.p50Ms / firstResult.p50Ms) /
      (lastResult.eventCount / firstResult.eventCount);
    const memGrowth =
      (lastResult.peakMemoryMB / firstResult.peakMemoryMB) /
      (lastResult.eventCount / firstResult.eventCount);

    markdown += `- **Time Complexity**: Approximately O(n log n) - ${timeGrowth.toFixed(2)}x time per event increase
- **Space Complexity**: Approximately O(n) - ${memGrowth.toFixed(2)}x memory per event increase
`;
  }

  markdown += `
### Recommendations

Based on these benchmarks:

`;

  const maxResult = results[results.length - 1];
  if (maxResult.p95Ms < 1000) {
    markdown += `- ✅ Rebuilds complete quickly (< 1 second) even for ${maxResult.eventCount.toLocaleString()} events\n`;
    markdown += `- ✅ No need for additional optimization at current scale\n`;
  } else if (maxResult.p95Ms < 5000) {
    markdown += `- ⚠️ Rebuilds may take several seconds for ${maxResult.eventCount.toLocaleString()} events\n`;
    markdown += `- ⚠️ Consider showing progress indicator for rebuilds > 1000 events\n`;
  } else {
    markdown += `- 🔴 Rebuilds are slow for ${maxResult.eventCount.toLocaleString()} events (${(maxResult.p95Ms / 1000).toFixed(1)}s)\n`;
    markdown += `- 🔴 Recommend implementing incremental updates or caching strategy\n`;
  }

  if (maxResult.peakMemoryMB > 100) {
    markdown += `- 🔴 High memory usage (${maxResult.peakMemoryMB.toFixed(0)} MB) may impact browser performance\n`;
    markdown += `- 🔴 Consider memory optimization techniques\n`;
  } else if (maxResult.peakMemoryMB > 50) {
    markdown += `- ⚠️ Moderate memory usage (${maxResult.peakMemoryMB.toFixed(0)} MB)\n`;
  } else {
    markdown += `- ✅ Memory usage is reasonable (< 50 MB)\n`;
  }

  markdown += `
## How to Run

\`\`\`bash
# Run benchmark
npx ts-node test/benchmark/merkle-rebuild.bench.ts

# Run with specific sizes
npx ts-node test/benchmark/merkle-rebuild.bench.ts --sizes 100,1000,10000

# Run with more iterations for accuracy
npx ts-node test/benchmark/merkle-rebuild.bench.ts --iterations 10

# Enable garbage collection for accurate memory measurements
node --expose-gc node_modules/.bin/ts-node test/benchmark/merkle-rebuild.bench.ts
\`\`\`

## Related Documentation

- [Cache Recovery Guide](./CACHE_RECOVERY.md)
- [Merkle Consistency Verification](../scripts/verify-merkle-consistency.ts)
- [Merkle Tree Implementation](../frontend/src/utils/crypto.ts)
`;

  return markdown;
}

/**
 * Print benchmark results to console
 */
function printResults(results: any[]): void {
  console.log("");
  console.log(
    `${colors.bold}${colors.cyan}=== Merkle Tree Rebuild Benchmark Results ===${colors.reset}`
  );
  console.log("");

  console.log(
    `${colors.bold}${"Event Count".padEnd(12)} | ${"P50 (ms)".padEnd(10)} | ${"P95 (ms)".padEnd(10)} | ${"P99 (ms)".padEnd(10)} | ${"Peak Mem (MB)".padEnd(15)} | Iterations${colors.reset}`
  );
  console.log("-".repeat(90));

  for (const result of results) {
    const eventStr = result.eventCount.toString().padEnd(12);
    const p50Str = result.p50Ms.toFixed(2).padEnd(10);
    const p95Str = result.p95Ms.toFixed(2).padEnd(10);
    const p99Str = result.p99Ms.toFixed(2).padEnd(10);
    const memStr = result.peakMemoryMB.toFixed(2).padEnd(15);
    const iterStr = result.iterations.toString();

    console.log(
      `${eventStr} | ${p50Str} | ${p95Str} | ${p99Str} | ${memStr} | ${iterStr}`
    );
  }

  console.log("");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const { sizes, iterations, output } = parseArgs();

    console.log(`${colors.bold}Configuration:${colors.reset}`);
    console.log(`  Event counts: ${colors.cyan}${sizes.join(", ")}${colors.reset}`);
    console.log(`  Iterations per size: ${colors.cyan}${iterations}${colors.reset}`);
    console.log(`  GC enabled: ${colors.cyan}${global.gc ? "Yes" : "No (run with --expose-gc for accurate memory measurements)"}${colors.reset}`);
    console.log("");

    const results: any[] = [];

    for (const size of sizes) {
      console.log(`${colors.bold}Benchmarking ${size} events...${colors.reset}`);
      const result = await benchmarkSize(size, iterations);
      results.push(result);

      console.log(
        `  ${colors.green}✓${colors.reset} P50: ${result.p50Ms.toFixed(2)}ms | P95: ${result.p95Ms.toFixed(2)}ms | Memory: ${result.peakMemoryMB.toFixed(2)}MB`
      );
      console.log("");
    }

    // Print results
    printResults(results);

    // Save to markdown
    const outputFile = output || "docs/BENCHMARKS.md";
    const markdown = formatMarkdown(results);

    const fs = require("fs");
    const path = require("path");
    const outputPath = path.resolve(process.cwd(), outputFile);

    fs.writeFileSync(outputPath, markdown, "utf-8");
    console.log(
      `${colors.green}✓${colors.reset} Results saved to ${colors.cyan}${outputFile}${colors.reset}`
    );
    console.log("");
  } catch (error: any) {
    console.error(`${colors.red}${colors.bold}Error:${colors.reset} ${error.message}`);
    if (error.stack) {
      console.error(`${colors.dim}${error.stack}${colors.reset}`);
    }
    process.exit(1);
  }
}

// Run the benchmark
if (require.main === module) {
  main();
}
