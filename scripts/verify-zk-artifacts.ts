#!/usr/bin/env npx ts-node
/**
 * WhisperFi ZK Artifacts Checksum Verification Script
 *
 * This script verifies the integrity of ZK artifacts by computing SHA256 checksums
 * and comparing source files with their frontend copies.
 *
 * Usage:
 *   npx ts-node scripts/verify-zk-artifacts.ts          # Verify checksums
 *   npx ts-node scripts/verify-zk-artifacts.ts --update # Update ARTIFACTS.md
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

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

// Project root directory
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Artifact definitions: source path and optional frontend copy path
interface ArtifactConfig {
  name: string;
  sourcePath: string;
  frontendPath?: string;
  description: string;
}

const ARTIFACTS: ArtifactConfig[] = [
  {
    name: "withdraw.wasm",
    sourcePath: "circuits/withdraw_js/withdraw.wasm",
    frontendPath: "frontend/public/zk/withdraw.wasm",
    description: "Withdraw circuit WASM binary",
  },
  {
    name: "withdraw.zkey",
    sourcePath: "circuits/withdraw_0001.zkey",
    frontendPath: "frontend/public/zk/withdraw.zkey",
    description: "Withdraw circuit proving key (zkey)",
  },
  {
    name: "Groth16Verifier.sol",
    sourcePath: "contracts/Groth16Verifier.sol",
    frontendPath: undefined, // No frontend copy
    description: "Groth16 on-chain verifier contract",
  },
];

/**
 * Compute SHA256 checksum of a file
 */
function computeSha256(filePath: string): string | null {
  const absolutePath = path.resolve(PROJECT_ROOT, filePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

/**
 * Get file size in human readable format
 */
function getFileSize(filePath: string): string {
  const absolutePath = path.resolve(PROJECT_ROOT, filePath);

  if (!fs.existsSync(absolutePath)) {
    return "N/A";
  }

  const stats = fs.statSync(absolutePath);
  const bytes = stats.size;

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get file modification time
 */
function getFileModTime(filePath: string): string {
  const absolutePath = path.resolve(PROJECT_ROOT, filePath);

  if (!fs.existsSync(absolutePath)) {
    return "N/A";
  }

  const stats = fs.statSync(absolutePath);
  return stats.mtime.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}

/**
 * Print verification result
 */
function printResult(
  success: boolean,
  message: string,
  details?: string
): void {
  const icon = success
    ? `${colors.green}\u2713${colors.reset}`
    : `${colors.red}\u2717${colors.reset}`;
  console.log(`  ${icon} ${message}`);
  if (details) {
    console.log(`    ${colors.dim}${details}${colors.reset}`);
  }
}

/**
 * Print file not found warning
 */
function printNotFound(filePath: string): void {
  console.log(
    `  ${colors.yellow}!${colors.reset} File not found: ${colors.dim}${filePath}${colors.reset}`
  );
}

interface VerificationResult {
  artifact: ArtifactConfig;
  sourceChecksum: string | null;
  frontendChecksum: string | null;
  sourceSize: string;
  sourceModTime: string;
  isMatch: boolean;
  sourceExists: boolean;
  frontendExists: boolean;
}

/**
 * Verify all artifacts and return results
 */
function verifyArtifacts(): VerificationResult[] {
  const results: VerificationResult[] = [];

  for (const artifact of ARTIFACTS) {
    const sourceChecksum = computeSha256(artifact.sourcePath);
    const frontendChecksum = artifact.frontendPath
      ? computeSha256(artifact.frontendPath)
      : null;

    const sourceExists = sourceChecksum !== null;
    const frontendExists = artifact.frontendPath
      ? frontendChecksum !== null
      : true;

    let isMatch = true;
    if (artifact.frontendPath && sourceExists && frontendExists) {
      isMatch = sourceChecksum === frontendChecksum;
    } else if (artifact.frontendPath && (!sourceExists || !frontendExists)) {
      isMatch = false;
    }

    results.push({
      artifact,
      sourceChecksum,
      frontendChecksum,
      sourceSize: getFileSize(artifact.sourcePath),
      sourceModTime: getFileModTime(artifact.sourcePath),
      isMatch,
      sourceExists,
      frontendExists,
    });
  }

  return results;
}

/**
 * Print verification report
 */
function printReport(results: VerificationResult[]): boolean {
  console.log("");
  console.log(
    `${colors.bold}${colors.cyan}=== WhisperFi ZK Artifacts Verification ===${colors.reset}`
  );
  console.log("");

  let allPassed = true;

  for (const result of results) {
    console.log(
      `${colors.bold}${result.artifact.name}${colors.reset} - ${result.artifact.description}`
    );

    // Source file status
    if (!result.sourceExists) {
      printNotFound(result.artifact.sourcePath);
      allPassed = false;
    } else {
      printResult(
        true,
        `Source: ${result.artifact.sourcePath}`,
        `SHA256: ${result.sourceChecksum}`
      );
      console.log(
        `    ${colors.dim}Size: ${result.sourceSize} | Modified: ${result.sourceModTime}${colors.reset}`
      );
    }

    // Frontend copy status (if applicable)
    if (result.artifact.frontendPath) {
      if (!result.frontendExists) {
        printNotFound(result.artifact.frontendPath);
        allPassed = false;
      } else if (!result.sourceExists) {
        console.log(
          `  ${colors.yellow}?${colors.reset} Frontend copy exists but source is missing`
        );
        allPassed = false;
      } else if (result.isMatch) {
        printResult(
          true,
          `Frontend copy matches: ${result.artifact.frontendPath}`
        );
      } else {
        printResult(
          false,
          `Frontend copy MISMATCH: ${result.artifact.frontendPath}`,
          `Expected: ${result.sourceChecksum}\n    Got:      ${result.frontendChecksum}`
        );
        allPassed = false;
      }
    }

    console.log("");
  }

  // Summary
  console.log(`${colors.bold}=== Summary ===${colors.reset}`);
  if (allPassed) {
    console.log(
      `${colors.green}${colors.bold}\u2713 All ZK artifacts verified successfully!${colors.reset}`
    );
  } else {
    console.log(
      `${colors.red}${colors.bold}\u2717 Some artifacts failed verification!${colors.reset}`
    );
    console.log(
      `${colors.yellow}Please ensure all ZK artifacts are properly compiled and copied.${colors.reset}`
    );
  }
  console.log("");

  return allPassed;
}

/**
 * Generate ARTIFACTS.md content
 */
function generateArtifactsMd(results: VerificationResult[]): string {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);

  let content = `# WhisperFi ZK Artifacts Checksums

> Auto-generated by \`verify-zk-artifacts.ts\`
> Last updated: ${now} UTC

## Artifact Checksums

This document records the SHA256 checksums of all ZK artifacts for integrity verification.

| Artifact | SHA256 Checksum | Size | Last Modified |
|----------|-----------------|------|---------------|
`;

  for (const result of results) {
    const checksum = result.sourceChecksum || "N/A (file not found)";
    const shortChecksum = result.sourceChecksum
      ? `\`${result.sourceChecksum.substring(0, 16)}...\``
      : "N/A";

    content += `| ${result.artifact.name} | ${shortChecksum} | ${result.sourceSize} | ${result.sourceModTime} |\n`;
  }

  content += `
## Full Checksums

`;

  for (const result of results) {
    content += `### ${result.artifact.name}

- **Description**: ${result.artifact.description}
- **Source Path**: \`${result.artifact.sourcePath}\`
`;

    if (result.artifact.frontendPath) {
      content += `- **Frontend Copy**: \`${result.artifact.frontendPath}\`
`;
    }

    if (result.sourceChecksum) {
      content += `- **SHA256**: \`${result.sourceChecksum}\`
- **Size**: ${result.sourceSize}
- **Modified**: ${result.sourceModTime}
`;
    } else {
      content += `- **Status**: File not found
`;
    }

    content += `
`;
  }

  content += `## Verification

To verify these checksums, run:

\`\`\`bash
npm run verify:zk
\`\`\`

To update this file with current checksums:

\`\`\`bash
npm run verify:zk -- --update
\`\`\`

## Notes

- The \`withdraw.wasm\` and \`withdraw.zkey\` files in \`frontend/public/zk/\` should be exact copies of the source files
- If verification fails, regenerate the ZK artifacts using the circuit compilation scripts
- The Groth16Verifier.sol is generated from the zkey file and must be kept in sync
`;

  return content;
}

/**
 * Update ARTIFACTS.md file
 */
function updateArtifactsMd(results: VerificationResult[]): void {
  const content = generateArtifactsMd(results);
  const outputPath = path.resolve(PROJECT_ROOT, "circuits/ARTIFACTS.md");

  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(
    `${colors.green}\u2713${colors.reset} Updated ${colors.cyan}circuits/ARTIFACTS.md${colors.reset}`
  );
}

/**
 * Main entry point
 */
function main(): void {
  const args = process.argv.slice(2);
  const shouldUpdate = args.includes("--update");

  // Verify artifacts
  const results = verifyArtifacts();
  const allPassed = printReport(results);

  // Update ARTIFACTS.md if requested
  if (shouldUpdate) {
    console.log(`${colors.bold}Updating ARTIFACTS.md...${colors.reset}`);
    updateArtifactsMd(results);
    console.log("");
  }

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run the script
main();
