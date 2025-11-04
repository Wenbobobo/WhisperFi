import { test, expect } from "@playwright/test";
import path from "path";
import { CONTRACTS } from "../src/config/contracts";

const WITHDRAW_TAB = 'button:has-text("Withdraw")';
const CACHE_STATUS = /Cache last synced/i;
const RESET_BUTTON = 'button:has-text("Reset Commitment Cache")';

const CHAIN_ID = 31337;
const CHAIN_ID_HEX = "0x7a69";
const MOCK_ACCOUNT = "0x1111111111111111111111111111111111111111";
const POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS.toLowerCase();
const COMMITMENT_KEY = `whisperfi:commitments:${CHAIN_ID}:${POOL_ADDRESS}`;
const SYNC_KEY_PREFIX = "whisperfi:commitment-sync:whisperfi-commitment-cache";

const ethereumStub = `
(() => {
  const accounts = ['${MOCK_ACCOUNT}'];
  const chainId = '${CHAIN_ID_HEX}';
  const balance = '0x56BC75E2D63100000';
  const listeners = {};
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return accounts;
        case 'eth_chainId':
          return chainId;
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain':
          return null;
        case 'eth_getBalance':
          return balance;
        default:
          return null;
      }
    },
    on: (event, handler) => {
      listeners[event] = handler;
    },
    removeListener: (event) => {
      delete listeners[event];
    },
  };
})();
`;

test.describe.skip("Commitment cache sync across tabs (pending harness)", () => {

  test("propagates cache reset between contexts", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript({ path: path.resolve(__dirname, "utils/walletMock.js") });
    await context.addInitScript(() => {
      window.__e2e__ = window.__e2e__ || {};
      window.__e2e__.autoConnect = true;
    });
    await context.addInitScript({ source: ethereumStub });

    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await Promise.all([pageA.goto("/"), pageB.goto("/")]);

    const connectButtonA = pageA.locator('button:has-text("Connect Wallet")');
    if (await connectButtonA.isVisible().catch(() => false)) {
      await connectButtonA.click();
    }
    const connectButtonB = pageB.locator('button:has-text("Connect Wallet")');
    if (await connectButtonB.isVisible().catch(() => false)) {
      await connectButtonB.click();
    }

    await pageA.waitForSelector(WITHDRAW_TAB, { timeout: 10000 });
    await pageB.waitForSelector(WITHDRAW_TAB, { timeout: 10000 });

    await pageA.locator(WITHDRAW_TAB).click();
    await pageB.locator(WITHDRAW_TAB).click();

    await pageA.evaluate(() => {
      window.__e2e__?.seedCommitments({
        commitments: ["0xabc123"],
        lastBlock: 5n,
      });
    });

    await pageA.reload();
    await pageB.reload();

    const connectButtonA2 = pageA.locator('button:has-text("Connect Wallet")');
    if (await connectButtonA2.isVisible().catch(() => false)) {
      await connectButtonA2.click();
    }
    const connectButtonB2 = pageB.locator('button:has-text("Connect Wallet")');
    if (await connectButtonB2.isVisible().catch(() => false)) {
      await connectButtonB2.click();
    }

    await Promise.all([
      pageA.locator(WITHDRAW_TAB).click(),
      pageB.locator(WITHDRAW_TAB).click(),
    ]);

    await expect(pageA.getByText(CACHE_STATUS)).toBeVisible();
    await expect(pageB.getByText(CACHE_STATUS)).toBeVisible();

    await pageA.locator(RESET_BUTTON).click();

    await expect(pageA.getByText(CACHE_STATUS)).not.toBeVisible();

    await pageB.waitForFunction(() => {
      const panels = Array.from(
        document.querySelectorAll("div")
      ).filter((div) => /Cache last synced/i.test(div.textContent || ""));
      return panels.length === 0;
    });

    const storageEmpty = await pageB.evaluate((k) => !localStorage.getItem(k), COMMITMENT_KEY);
    expect(storageEmpty).toBe(true);

    await context.close();
  });
});
