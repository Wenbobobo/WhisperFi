import { test, expect } from "@playwright/test";
import { CONTRACTS } from "../src/config/contracts";

const WITHDRAW_TAB = 'button:has-text("Withdraw")';
const CACHE_STATUS = /Cache last synced/i;
const RESET_BUTTON = 'button:has-text("Reset Commitment Cache")';
const CONNECT_BUTTON = 'button:has-text("Connect Wallet")';

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
    await context.addInitScript({ source: ethereumStub });

    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await Promise.all([pageA.goto("/"), pageB.goto("/")]);

    // Connect wallet in both tabs (stubbed) so Withdraw tab renders.
    await pageA.locator(CONNECT_BUTTON).click();
    await pageB.locator(CONNECT_BUTTON).click();
    await pageA.waitForSelector(WITHDRAW_TAB);
    await pageB.waitForSelector(WITHDRAW_TAB);

    await pageA.locator(WITHDRAW_TAB).click();
    await pageB.locator(WITHDRAW_TAB).click();

    // Seed commitments into shared localStorage (context-level) and broadcast refresh.
    await pageA.goto("/");

    await pageA.locator(CONNECT_BUTTON).click();
    await pageA.waitForSelector(WITHDRAW_TAB);
    await pageA.locator(WITHDRAW_TAB).click();

    await pageA.evaluate(
      ([commitmentKey, syncPrefix]) => {
        const payload = {
          commitments: ["0xabc123"],
          lastBlock: "5",
          updatedAt: Date.now(),
        };
        localStorage.setItem(commitmentKey, JSON.stringify(payload));
        localStorage.setItem(
          `${syncPrefix}:${Date.now()}`,
          JSON.stringify({
            chainId: 31337,
            address: "0x2279b7a0a67db372996a5fab50d91eaa73d2ebe6",
            action: "refresh",
            updatedAt: payload.updatedAt,
            sourceId: "playwright-seed",
          })
        );
      },
      [COMMITMENT_KEY, SYNC_KEY_PREFIX]
    );

    await pageA.reload();
    await pageB.reload();

    await pageA.locator(CONNECT_BUTTON).click();
    await pageB.locator(CONNECT_BUTTON).click();
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
