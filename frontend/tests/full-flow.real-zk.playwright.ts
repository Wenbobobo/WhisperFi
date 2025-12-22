/**
 * Full E2E Test with REAL ZK Proof Generation
 *
 * This test performs the complete workflow:
 * 1. Start local Hardhat network
 * 2. Deploy all contracts (WITH REAL VERIFIER)
 * 3. Perform deposit transaction
 * 4. Generate REAL ZK proof (using circomlibjs + snarkjs)
 * 5. Submit withdrawal with proof verification
 * 6. Verify funds transfer
 *
 * Note: This test is slower (~60-90s) due to real ZK proof generation
 * but provides true end-to-end validation.
 */

import { test, expect } from "@playwright/test";
import path from "path";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { createRequire } from "module";
import { setTimeout as delay } from "timers/promises";
import { ethers } from "ethers";
import { CONTRACTS } from "../src/config/contracts";
import PrivacyPoolArtifact from "../src/abi/PrivacyPool.json";
import {
  PLAYWRIGHT_NOTE,
  PLAYWRIGHT_RELAYER,
  PLAYWRIGHT_RECIPIENT,
  PLAYWRIGHT_USER,
  PLAYWRIGHT_NOTE_SECRET,
  HARDHAT_RPC_URL,
} from "../../playwright/constants/e2e";

const CHAIN_ID = 31337;
const NOTE_VALUE = PLAYWRIGHT_NOTE;
const RECIPIENT = PLAYWRIGHT_RECIPIENT.address;
const RELAYER = PLAYWRIGHT_RELAYER.address;
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const HARDHAT_HOST = "127.0.0.1";
const HARDHAT_PORT = 8545;
const SPAWN_USES_SHELL = false; // Fixed: Never use shell=true on Windows with spaces in path
const require = createRequire(__filename);
const HARDHAT_CLI = require.resolve("hardhat/internal/cli/cli", {
  paths: [ROOT_DIR],
});

async function waitForRpcReady() {
  const url = `http://${HARDHAT_HOST}:${HARDHAT_PORT}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) {
        console.log(`  ✅ Hardhat RPC ready after ${attempt * 500}ms`);
        return;
      }
    } catch {
      // ignore and retry
    }
    await delay(500);
  }
  throw new Error("Timed out waiting for Hardhat RPC to become ready");
}

async function startHardhatNode() {
  console.log("📡 Starting Hardhat local network...");
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [
        HARDHAT_CLI,
        "node",
        "--hostname",
        HARDHAT_HOST,
        "--port",
        String(HARDHAT_PORT),
      ],
      {
        cwd: ROOT_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        shell: SPAWN_USES_SHELL,
      }
    );

    proc.stderr.on("data", (chunk) => process.stderr.write(chunk));
    proc.once("error", (err) => reject(err));
    proc.once("exit", (code) => {
      reject(new Error(`Hardhat node exited prematurely with code ${code ?? "unknown"}`));
    });

    waitForRpcReady()
      .then(() => resolve(proc))
      .catch((err) => {
        proc.kill();
        reject(err);
      });
  });
}

async function stopHardhatNode(proc: ChildProcessWithoutNullStreams | undefined | null) {
  if (!proc) return;
  console.log("🛑 Stopping Hardhat network...");
  await new Promise<void>((resolve) => {
    proc.once("exit", () => resolve());
    proc.kill();
    setTimeout(() => resolve(), 1_000).unref();
  });
}

async function runHardhatScript(scriptRelativePath: string, extraEnv: Record<string, string> = {}) {
  console.log(`🔧 Running script: ${scriptRelativePath}...`);
  return new Promise<string>((resolve, reject) => {
    const scriptPath = path.join(ROOT_DIR, scriptRelativePath);
    const child = spawn(
      process.execPath,
      [HARDHAT_CLI, "run", scriptPath, "--network", "localhost"],
      {
        cwd: ROOT_DIR,
        env: { ...process.env, ...extraEnv },
        stdio: ["ignore", "pipe", "pipe"],
        shell: SPAWN_USES_SHELL,
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`  ✅ Script completed`);
        resolve(stdout.trim());
      } else {
        reject(new Error(`Hardhat script ${scriptRelativePath} failed (${code}): ${stderr}`));
      }
    });
  });
}

test.describe("Full E2E Flow with Real ZK Proof", () => {
  test.describe.configure({ mode: "serial" });

  let hardhatProcess: ChildProcessWithoutNullStreams | null = null;
  let provider: ethers.JsonRpcProvider;
  let userWallet: ethers.Wallet;
  let merkleRootHex = "0x";
  let commitment = "0x";

  test.beforeAll(async () => {
    console.log("\n🚀 Setting up Full E2E Test Environment\n");
    console.log("=" .repeat(60));

    // Step 1: Start Hardhat network
    hardhatProcess = await startHardhatNode();

    // Step 2: Deploy contracts (USE_MOCK_VERIFIER=false for real ZK verification)
    console.log("📦 Deploying contracts with REAL verifier...");
    await runHardhatScript("scripts/deploy.ts", { USE_MOCK_VERIFIER: "false" });

    // Step 3: Seed test data (deposit)
    console.log("💰 Seeding test deposit...");
    const seedOutput = await runHardhatScript("scripts/seed-playwright-withdraw.ts");
    const payloadLine = seedOutput.split(/\r?\n/).filter(Boolean).pop() ?? "{}";
    const parsed = JSON.parse(payloadLine);
    merkleRootHex = parsed.merkleRoot;
    commitment = parsed.commitment;

    // Step 4: Setup provider and wallet
    provider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
    userWallet = new ethers.Wallet(PLAYWRIGHT_USER.privateKey, provider);

    console.log("\n📊 Test Environment Ready:");
    console.log(`  Network: Hardhat Local (${HARDHAT_RPC_URL})`);
    console.log(`  Chain ID: ${CHAIN_ID}`);
    console.log(`  PrivacyPool: ${CONTRACTS.PRIVACY_POOL_ADDRESS}`);
    console.log(`  Merkle Root: ${merkleRootHex}`);
    console.log(`  Commitment: ${commitment}`);
    console.log(`  User: ${PLAYWRIGHT_USER.address}`);
    console.log(`  Recipient: ${RECIPIENT}`);
    console.log(`  Relayer: ${RELAYER}`);
    console.log("=" .repeat(60) + "\n");
  });

  test.afterAll(async () => {
    await stopHardhatNode(hardhatProcess);
  });

  test("performs complete deposit -> proof generation -> withdrawal flow", async ({ browser }) => {
    test.setTimeout(240_000); // 4 minutes (ZK proof generation is slow)

    console.log("\n🧪 Starting Full E2E Test\n");

    const context = await browser.newContext();
    await context.addInitScript({ path: path.resolve(__dirname, "utils/walletMock.js") });

    const page = await context.newPage();

    // Enable console logging from browser
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`  🔴 Browser Error: ${msg.text()}`);
      } else if (msg.text().includes("[WhisperFi]")) {
        console.log(`  💬 ${msg.text()}`);
      }
    });

    console.log("📄 Navigating to withdraw page...");
    await page.goto("/e2e/withdraw", { waitUntil: "domcontentloaded" });

    // Prepare submission handler
    await page.exposeFunction("playwrightSubmitWithdrawal", async (submission: any) => {
      console.log("\n📤 Submitting withdrawal transaction...");
      console.log(`  Recipient: ${submission.recipient}`);
      console.log(`  Relayer: ${submission.relayer}`);
      console.log(`  Fee: ${ethers.formatEther(submission.fee)} ETH`);
      console.log(`  📊 Proof data:`);
      console.log(`    publicSignals:`, submission.publicSignals);
      console.log(`    merkleRoot:`, submission.merkleRoot);
      console.log(`    nullifierHash:`, submission.nullifierHash);

      // toWithdrawArgs will be provided by the page context (exposed by WithdrawCard)
      // We'll call it from the page context instead of importing here
      const args = await page.evaluate((sub) => {
        const { toWithdrawArgs } = window.__e2e__ as any;
        return toWithdrawArgs(
          sub.proof,
          sub.publicSignals,
          sub.recipient,
          BigInt(sub.fee),
          sub.relayer,
          sub.merkleRoot,
          sub.nullifierHash
        );
      }, submission);

      const contract = new ethers.Contract(
        CONTRACTS.PRIVACY_POOL_ADDRESS,
        PrivacyPoolArtifact.abi,
        userWallet
      );

      // Capture balances before
      const relayerBefore = await provider.getBalance(RELAYER);
      const recipientBefore = await provider.getBalance(RECIPIENT);
      const poolBefore = await provider.getBalance(CONTRACTS.PRIVACY_POOL_ADDRESS);

      console.log("\n  💼 Balances Before:");
      console.log(`    Pool: ${ethers.formatEther(poolBefore)} ETH`);
      console.log(`    Recipient: ${ethers.formatEther(recipientBefore)} ETH`);
      console.log(`    Relayer: ${ethers.formatEther(relayerBefore)} ETH`);

      // Submit transaction
      console.log("\n  📡 Broadcasting transaction...");
      let tx, receipt;
      try {
        tx = await contract.withdraw(...args);
        console.log(`  🔗 Tx Hash: ${tx.hash}`);

        console.log("  ⏳ Waiting for confirmation...");
        receipt = await tx.wait();
        console.log(`  ✅ Confirmed in block ${receipt?.blockNumber}`);
      } catch (error: any) {
        console.error("  ❌ Transaction failed:", error.message);
        if (error.data) console.error("  Error data:", error.data);
        if (error.reason) console.error("  Reason:", error.reason);
        throw error;
      }

      // Capture balances after
      const relayerAfter = await provider.getBalance(RELAYER);
      const recipientAfter = await provider.getBalance(RECIPIENT);
      const poolAfter = await provider.getBalance(CONTRACTS.PRIVACY_POOL_ADDRESS);

      console.log("\n  💼 Balances After:");
      console.log(`    Pool: ${ethers.formatEther(poolAfter)} ETH`);
      console.log(`    Recipient: ${ethers.formatEther(recipientAfter)} ETH`);
      console.log(`    Relayer: ${ethers.formatEther(relayerAfter)} ETH`);

      const relayerGain = relayerAfter - relayerBefore;
      const recipientGain = recipientAfter - recipientBefore;

      console.log("\n  📈 Gains:");
      console.log(`    Recipient: +${ethers.formatEther(recipientGain)} ETH`);
      console.log(`    Relayer: +${ethers.formatEther(relayerGain)} ETH`);

      const result = {
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        relayerGain: relayerGain.toString(),
        recipientGain: recipientGain.toString(),
      };

      console.log("\n  ✅ Returning result:", result);
      return result;
    });

    // Wait for E2E helpers to be available
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__e2e__);

    // Setup E2E environment (NO MOCKING - use real proof generation)
    console.log("⚙️  Configuring E2E environment...");
    await page.evaluate(
      ({ chainId, poolAddress }) => {
        window.__e2e__ = window.__e2e__ || {};
        window.__e2e__.setPoolAddress?.(poolAddress);
        window.__e2e__.enableAutoConnect?.();
        window.__e2e__.updateConnectionState?.({
          isConnected: true,
          chainId,
        });

        // IMPORTANT: DO NOT mock proof generation - use real ZK proof
        // The frontend will call real generateProof() function

        // Override submission to use our test handler
        window.__e2e__.submitWithdrawalOverride = async (args) => {
          console.log("[E2E Override] Called with merkleRoot:", args.merkleRoot, "nullifierHash:", args.nullifierHash);
          const result = await (window as any).playwrightSubmitWithdrawal(args);
          console.log("[E2E Override] Received result:", result);
          window.__e2e__.lastSubmission = {
            ...args,
            fee: args.fee.toString(),
          };
          window.__e2e__.lastSubmissionResult = result;
          console.log("[E2E Override] Set lastSubmissionResult:", window.__e2e__.lastSubmissionResult);
          return result;
        };

        // Trigger wallet connection
        if (window.ethereum?.request) {
          window.ethereum
            .request({ method: "eth_requestAccounts" })
            .catch((err: unknown) => console.warn("[E2E] eth_requestAccounts failed", err));
        }
      },
      {
        chainId: CHAIN_ID,
        poolAddress: CONTRACTS.PRIVACY_POOL_ADDRESS,
      }
    );

    // Wait for wallet connection
    console.log("🔗 Connecting wallet...");
    await page.waitForFunction(
      (expectedChainId) =>
        window.__e2e__?.connectionState?.isConnected === true &&
        window.__e2e__?.connectionState?.chainId === expectedChainId,
      CHAIN_ID
    );

    // Wait for component hydration
    await page.waitForFunction(
      () => window.__e2e__?.withdrawHydrated === true,
      null,
      { timeout: 10_000 }
    );

    console.log("✅ Wallet connected and UI ready\n");

    // ============================================================================
    // Step 1: Fill in withdrawal form
    // ============================================================================
    console.log("📝 Step 1: Filling withdrawal form...");

    const noteInput = page.getByLabel("Private Note");
    await expect(noteInput).toBeVisible();
    await noteInput.fill(NOTE_VALUE);
    await expect(noteInput).toHaveValue(NOTE_VALUE);

    const recipientInput = page.getByLabel("Recipient Address");
    await recipientInput.fill(RECIPIENT);
    await expect(recipientInput).toHaveValue(RECIPIENT);

    const relayerInput = page.getByLabel("Relayer Address");
    await relayerInput.fill(RELAYER);
    await expect(relayerInput).toHaveValue(RELAYER);

    const feeInput = page.getByLabel("Relayer Fee (ETH)");
    await feeInput.fill("0.01");
    await expect(feeInput).toHaveValue("0.01");

    console.log("  ✅ Form filled");

    // ============================================================================
    // Step 2: Generate REAL ZK Proof
    // ============================================================================
    console.log("\n🔐 Step 2: Generating REAL ZK Proof...");
    console.log("  ⚠️  This will take 30-60 seconds (real circuit computation)");

    const generateProofButton = page.getByRole("button", { name: "Generate Proof" });
    await expect(generateProofButton).toBeVisible();
    await expect(generateProofButton).toBeEnabled();

    const proofStartTime = Date.now();
    await generateProofButton.click();

    // Wait for proof generation success (this is the real deal!)
    await expect(page.getByText(/Proof generated successfully/i)).toBeVisible({
      timeout: 120_000 // 2 minutes max for proof generation
    });

    const proofDuration = ((Date.now() - proofStartTime) / 1000).toFixed(1);
    console.log(`  ✅ Proof generated in ${proofDuration}s`);

    // ============================================================================
    // Step 3: Submit Withdrawal Transaction
    // ============================================================================
    console.log("\n💸 Step 3: Submitting withdrawal...");

    const submitButton = page.getByRole("button", { name: "Submit Withdrawal" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    await submitButton.click();

    // In E2E environment, wallet is mocked so transaction submits immediately
    // Wait for submission confirmation message
    await expect(page.getByText(/Withdrawal submitted/i)).toBeVisible({ timeout: 10_000 });
    console.log("  ✅ Withdrawal submitted");

    // Wait for transaction to complete
    console.log("  ⏳ Waiting for blockchain confirmation...");
    await page.waitForFunction(() => Boolean(window.__e2e__?.lastSubmissionResult?.txHash), {
      timeout: 30_000,
    });

    // ============================================================================
    // Step 4: Verify Results
    // ============================================================================
    console.log("\n✅ Step 4: Verifying results...");

    const submission = await page.evaluate(() => window.__e2e__?.lastSubmission);
    const submissionResult = await page.evaluate(() => window.__e2e__?.lastSubmissionResult);

    expect(submission).toBeTruthy();
    expect(submission.recipient.toLowerCase()).toBe(RECIPIENT.toLowerCase());
    expect(submission.relayer.toLowerCase()).toBe(RELAYER.toLowerCase());
    expect(BigInt(submission.fee)).toBe(ethers.parseEther("0.01"));

    expect(submissionResult?.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(submissionResult?.blockNumber).toBeGreaterThan(0);

    // Verify fund distribution
    const expectedRecipientGain = ethers.parseEther("0.1") - ethers.parseEther("0.01");
    const expectedRelayerGain = ethers.parseEther("0.01");

    expect(BigInt(submissionResult?.recipientGain)).toBe(expectedRecipientGain);
    expect(BigInt(submissionResult?.relayerGain)).toBe(expectedRelayerGain);

    console.log("\n🎉 Full E2E Test Completed Successfully!");
    console.log("=" .repeat(60));
    console.log("✅ Deposit executed");
    console.log("✅ Real ZK proof generated and verified");
    console.log("✅ Withdrawal executed on-chain");
    console.log("✅ Funds distributed correctly");
    console.log("=" .repeat(60) + "\n");

    await context.close();
  });

  test("verifies nullifier prevents double-spend", async ({ browser }) => {
    test.setTimeout(240_000);

    console.log("\n🧪 Testing Double-Spend Prevention\n");

    const context = await browser.newContext();
    await context.addInitScript({ path: path.resolve(__dirname, "utils/walletMock.js") });

    const page = await context.newPage();

    // Suppress non-critical console logs for this test
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.text().includes("revert") || msg.text().includes("nullifier")) {
        console.log(`  💬 ${msg.text()}`);
      }
    });

    await page.goto("/e2e/withdraw", { waitUntil: "domcontentloaded" });

    // Setup submission handler that tracks attempts
    let attemptCount = 0;
    await page.exposeFunction("playwrightSubmitWithdrawal", async (submission: any) => {
      attemptCount++;
      console.log(`\n📤 Withdrawal Attempt #${attemptCount}`);

      const { toWithdrawArgs } = await import("../src/lib/zk/submit");
      const args = toWithdrawArgs(
        submission.proof,
        submission.publicSignals,
        submission.recipient,
        BigInt(submission.fee),
        submission.relayer,
        submission.merkleRoot,
        submission.nullifierHash
      );

      const contract = new ethers.Contract(
        CONTRACTS.PRIVACY_POOL_ADDRESS,
        PrivacyPoolArtifact.abi,
        userWallet
      );

      try {
        const tx = await contract.withdraw(...args);
        await tx.wait();
        console.log(`  ✅ Attempt #${attemptCount} succeeded: ${tx.hash}`);
        return { success: true, txHash: tx.hash, error: null };
      } catch (error: any) {
        console.log(`  ❌ Attempt #${attemptCount} failed: ${error.message}`);
        return { success: false, txHash: null, error: error.message };
      }
    });

    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__e2e__);

    await page.evaluate(
      ({ chainId, poolAddress }) => {
        window.__e2e__ = window.__e2e__ || {};
        window.__e2e__.setPoolAddress?.(poolAddress);
        window.__e2e__.enableAutoConnect?.();
        window.__e2e__.updateConnectionState?.({ isConnected: true, chainId });

        window.__e2e__.submitWithdrawalOverride = async (args) => {
          const result = await (window as any).playwrightSubmitWithdrawal(args);
          window.__e2e__.lastSubmissionResult = result;
        };

        if (window.ethereum?.request) {
          window.ethereum.request({ method: "eth_requestAccounts" }).catch(() => {});
        }
      },
      { chainId: CHAIN_ID, poolAddress: CONTRACTS.PRIVACY_POOL_ADDRESS }
    );

    await page.waitForFunction(
      (expectedChainId) =>
        window.__e2e__?.connectionState?.isConnected === true &&
        window.__e2e__?.connectionState?.chainId === expectedChainId,
      CHAIN_ID
    );

    console.log("🔐 First withdrawal attempt (should succeed)...");

    // First withdrawal
    await page.getByLabel("Private Note").fill(NOTE_VALUE);
    await page.getByLabel("Recipient Address").fill(RECIPIENT);
    await page.getByLabel("Relayer Address").fill(RELAYER);
    await page.getByLabel("Relayer Fee (ETH)").fill("0.01");

    await page.getByRole("button", { name: "Generate Proof" }).click();
    await expect(page.getByText(/Proof generated successfully/i)).toBeVisible({ timeout: 120_000 });

    await page.getByRole("button", { name: "Submit Withdrawal" }).click();
    await page.waitForFunction(() => window.__e2e__?.lastSubmissionResult !== undefined, {
      timeout: 30_000,
    });

    const firstResult = await page.evaluate(() => window.__e2e__?.lastSubmissionResult);
    expect(firstResult?.success).toBe(true);
    console.log("✅ First withdrawal succeeded");

    // Attempt second withdrawal with SAME note (should fail due to nullifier)
    console.log("\n🔐 Second withdrawal attempt with same note (should fail)...");

    // Clear previous result
    await page.evaluate(() => {
      if (window.__e2e__) {
        window.__e2e__.lastSubmissionResult = undefined;
      }
    });

    // Reload page to reset state
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__e2e__);

    await page.evaluate(
      ({ chainId, poolAddress }) => {
        window.__e2e__ = window.__e2e__ || {};
        window.__e2e__.setPoolAddress?.(poolAddress);
        window.__e2e__.enableAutoConnect?.();
        window.__e2e__.updateConnectionState?.({ isConnected: true, chainId });

        window.__e2e__.submitWithdrawalOverride = async (args) => {
          const result = await (window as any).playwrightSubmitWithdrawal(args);
          window.__e2e__.lastSubmissionResult = result;
        };

        if (window.ethereum?.request) {
          window.ethereum.request({ method: "eth_requestAccounts" }).catch(() => {});
        }
      },
      { chainId: CHAIN_ID, poolAddress: CONTRACTS.PRIVACY_POOL_ADDRESS }
    );

    // Try second withdrawal with same note
    await page.getByLabel("Private Note").fill(NOTE_VALUE);
    await page.getByLabel("Recipient Address").fill(RECIPIENT);
    await page.getByLabel("Relayer Address").fill(RELAYER);
    await page.getByLabel("Relayer Fee (ETH)").fill("0.01");

    await page.getByRole("button", { name: "Generate Proof" }).click();
    await expect(page.getByText(/Proof generated successfully/i)).toBeVisible({ timeout: 120_000 });

    await page.getByRole("button", { name: "Submit Withdrawal" }).click();
    await page.waitForFunction(() => window.__e2e__?.lastSubmissionResult !== undefined, {
      timeout: 30_000,
    });

    const secondResult = await page.evaluate(() => window.__e2e__?.lastSubmissionResult);
    expect(secondResult?.success).toBe(false);
    expect(secondResult?.error).toMatch(/nullifier|already|spent|used/i);

    console.log("✅ Second withdrawal correctly rejected (nullifier already used)");
    console.log("\n🎉 Double-Spend Prevention Test Passed!");
    console.log("=" .repeat(60) + "\n");

    await context.close();
  });
});
