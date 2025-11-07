import { test, expect } from "@playwright/test";
import path from "path";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { createRequire } from "module";
import { setTimeout as delay } from "timers/promises";
import { ethers } from "ethers";
import { CONTRACTS } from "../src/config/contracts";
import PrivacyPoolArtifact from "../src/abi/PrivacyPool.json";
import { toWithdrawArgs } from "../src/lib/zk/submit";
import {
  PLAYWRIGHT_NOTE,
  PLAYWRIGHT_RELAYER,
  PLAYWRIGHT_RECIPIENT,
  PLAYWRIGHT_USER,
  PLAYWRIGHT_NULLIFIER_HASH,
  HARDHAT_RPC_URL,
} from "../../playwright/constants/e2e";

const CHAIN_ID = 31337;
const NOTE_VALUE = PLAYWRIGHT_NOTE;
const RECIPIENT = PLAYWRIGHT_RECIPIENT.address;
const RELAYER = PLAYWRIGHT_RELAYER.address;
const FEE_ETH = "0.002";
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const HARDHAT_HOST = "127.0.0.1";
const HARDHAT_PORT = 8545;
const SPAWN_USES_SHELL = process.platform === "win32";
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
  await new Promise<void>((resolve) => {
    proc.once("exit", () => resolve());
    proc.kill();
    setTimeout(() => resolve(), 1_000).unref();
  });
}

async function runHardhatScript(scriptRelativePath: string, extraEnv: Record<string, string> = {}) {
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
        resolve(stdout.trim());
      } else {
        reject(new Error(`Hardhat script ${scriptRelativePath} failed (${code}): ${stderr}`));
      }
    });
  });
}

test.describe("Withdraw form submission with relayer fee", () => {
  test.describe.configure({ mode: "serial" });

  let hardhatProcess: ChildProcessWithoutNullStreams | null = null;
  let provider: ethers.JsonRpcProvider;
  let userWallet: ethers.Wallet;
  let merkleRootHex = "0x";

  test.beforeAll(async () => {
    hardhatProcess = await startHardhatNode();
    await runHardhatScript("scripts/deploy.ts", { USE_MOCK_VERIFIER: "true" });
    const seedOutput = await runHardhatScript("scripts/seed-playwright-withdraw.ts");
    const payloadLine = seedOutput.split(/\r?\n/).filter(Boolean).pop() ?? "{}";
    const parsed = JSON.parse(payloadLine);
    merkleRootHex = parsed.merkleRoot;
    provider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
    userWallet = new ethers.Wallet(PLAYWRIGHT_USER.privateKey, provider);
  });

  test.afterAll(async () => {
    await stopHardhatNode(hardhatProcess);
  });

  test("submits via mocked proof and executes on Hardhat", async ({ browser }) => {
    test.setTimeout(180_000);

    const context = await browser.newContext();
    await context.addInitScript({ path: path.resolve(__dirname, "utils/walletMock.js") });

    const page = await context.newPage();
    await page.goto("/e2e/withdraw", { waitUntil: "domcontentloaded" });

    const rootDecimal = BigInt(merkleRootHex).toString();
    const nullifierDecimal = BigInt(PLAYWRIGHT_NULLIFIER_HASH).toString();

    await page.exposeFunction("playwrightSubmitWithdrawal", async (submission: any) => {
      const args = toWithdrawArgs(
        submission.proof,
        submission.publicSignals,
        submission.recipient,
        BigInt(submission.fee),
        submission.relayer
      );
      const contract = new ethers.Contract(
        CONTRACTS.PRIVACY_POOL_ADDRESS,
        PrivacyPoolArtifact.abi,
        userWallet
      );
      const relayerBefore = await provider.getBalance(RELAYER);
      const recipientBefore = await provider.getBalance(RECIPIENT);
      const tx = await contract.withdraw(...args);
      await tx.wait();
      const relayerAfter = await provider.getBalance(RELAYER);
      const recipientAfter = await provider.getBalance(RECIPIENT);
      return {
        txHash: tx.hash,
        relayerGain: (relayerAfter - relayerBefore).toString(),
        recipientGain: (recipientAfter - recipientBefore).toString(),
      };
    });

    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__e2e__);
    await page.evaluate(
      ({ chainId, poolAddress, merkleRoot, nullifier }) => {
        window.__e2e__ = window.__e2e__ || {};
        window.__e2e__.setPoolAddress?.(poolAddress);
        window.__e2e__.enableAutoConnect?.();
        window.__e2e__.updateConnectionState?.({
          isConnected: true,
          chainId,
        });

        const proofStub = {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
        };

        window.__e2e__.mockGenerateProof = async () => ({
          proof: proofStub,
          publicSignals: [merkleRoot, nullifier],
          cacheInfo: {
            lastSyncedAt: Date.now(),
            expiresAt: Date.now() + 30 * 60 * 1000,
            commitmentCount: 1,
          },
        });

        window.__e2e__.submitWithdrawalOverride = async (args) => {
          const result = await (window as any).playwrightSubmitWithdrawal(args);
          window.__e2e__.lastSubmission = {
            ...args,
            fee: args.fee.toString(),
          };
          window.__e2e__.lastSubmissionResult = result;
        };

        window.__e2e__.seedCommitments?.({
          commitments: ["0xabc123"],
          lastBlock: 5,
          chainId,
        });

        if (window.ethereum?.request) {
          window.ethereum
            .request({ method: "eth_requestAccounts" })
            .catch((err: unknown) => console.warn("eth_requestAccounts failed", err));
        }
      },
      { chainId: CHAIN_ID, poolAddress: CONTRACTS.PRIVACY_POOL_ADDRESS, merkleRoot: rootDecimal, nullifier: nullifierDecimal }
    );

    await page.waitForFunction(
      (expectedChainId) =>
        window.__e2e__?.connectionState?.isConnected === true &&
        window.__e2e__?.connectionState?.chainId === expectedChainId,
      CHAIN_ID
    );

    await page.waitForFunction(
      () => window.__e2e__?.withdrawHydrated === true,
      null,
      { timeout: 5_000 }
    );

    await page.getByLabel("Private Note").fill(NOTE_VALUE);
    await page.getByLabel("Recipient Address").fill(RECIPIENT);
    await page.getByLabel("Relayer Address").fill(RELAYER);
    await page.getByLabel("Relayer Fee (ETH)").fill(FEE_ETH);
    await expect(page.getByLabel("Private Note")).toHaveValue(NOTE_VALUE);
    await expect(page.getByLabel("Recipient Address")).toHaveValue(RECIPIENT);
    await expect(page.getByLabel("Relayer Address")).toHaveValue(RELAYER);
    await expect(page.getByLabel("Relayer Fee (ETH)")).toHaveValue(FEE_ETH);

    await page.getByRole("button", { name: "Generate Proof" }).click();
    await expect(page.getByText(/Proof generated successfully/i)).toBeVisible();

    await page.getByRole("button", { name: "Submit Withdrawal" }).click();
    await expect(page.getByText(/Please confirm the transaction in your wallet/i)).toBeVisible();

    await page.waitForFunction(() => Boolean(window.__e2e__?.lastSubmissionResult?.txHash));
    const submission = await page.evaluate(() => window.__e2e__?.lastSubmission);
    const submissionResult = await page.evaluate(() => window.__e2e__?.lastSubmissionResult);

    expect(submission).toBeTruthy();
    expect(submission.recipient.toLowerCase()).toBe(RECIPIENT.toLowerCase());
    expect(submission.relayer.toLowerCase()).toBe(RELAYER.toLowerCase());
    expect(BigInt(submission.fee)).toBe(ethers.parseEther(FEE_ETH));

    expect(submissionResult?.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(BigInt(submissionResult?.relayerGain)).toBe(ethers.parseEther(FEE_ETH));
    expect(BigInt(submissionResult?.recipientGain)).toBe(
      ethers.parseEther("0.1") - ethers.parseEther(FEE_ETH)
    );

    await context.close();
  });
});
