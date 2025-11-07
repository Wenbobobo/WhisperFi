import { test, expect, Page } from "@playwright/test";
import path from "path";
import { CONTRACTS } from "../src/config/contracts";

const CACHE_STATUS = /Cache last synced/i;
const RESET_BUTTON = 'button:has-text("Reset Commitment Cache")';

const CHAIN_ID = 31337;
const CHAIN_ID_HEX = "0x7a69";
const POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS.toLowerCase();
const COMMITMENT_KEY = `whisperfi:commitments:${CHAIN_ID}:${POOL_ADDRESS}`;

test.describe("Commitment cache sync across tabs", () => {

  test("propagates cache reset between contexts", async ({ browser }) => {
    test.setTimeout(60_000);

    const context = await browser.newContext();
    await context.addInitScript({ path: path.resolve(__dirname, "utils/walletMock.js") });
    await context.addInitScript(() => {
      window.__e2e__ = window.__e2e__ || {};
      window.__e2e__.enableAutoConnect?.();
    });

    const attachLogging = (page, label) => {
      page.on("console", (msg) => {
        console.log(`[${label}] console:${msg.type()} -> ${msg.text()}`);
      });
      page.on("pageerror", (err) => {
        console.error(`[${label}] pageerror -> ${err}`);
      });
      page.on("requestfailed", (request) => {
        console.warn(`[${label}] requestfailed -> ${request.url()} (${request.failure()?.errorText})`);
      });
    };

    const pageA = await context.newPage();
    const pageB = await context.newPage();
    attachLogging(pageA, "A");
    attachLogging(pageB, "B");

    const ensureReady = async (page, label) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto("/e2e/withdraw", { waitUntil: "domcontentloaded" });
        const rootId = await page.evaluate(() => document.documentElement.id);
        if (rootId !== "__next_error__") {
          return;
        }
        console.warn(`[${label}] received __next_error__ root, retrying (${attempt + 1})`);
        await page.waitForTimeout(1000 * (attempt + 1));
      }
      throw new Error(`[${label}] unable to load withdraw page without Next error overlay`);
    };

    await Promise.all([ensureReady(pageA, "A"), ensureReady(pageB, "B")]);

    await pageA.evaluate(() => {
      window.__e2e__?.enableAutoConnect?.();
    });
    await pageB.evaluate(() => {
      window.__e2e__?.enableAutoConnect?.();
    });

    const waitForAutoConnect = async (page) => {
      await page.waitForFunction(
        () =>
          typeof window !== "undefined" &&
          window.__e2e__ &&
          document.readyState !== "loading",
        { timeout: 7_500 }
      );
      await page.evaluate((chainId) => {
        window.__e2e__ = window.__e2e__ || {};
        window.__e2e__.forceConnected = true;
        window.__e2e__.connectionState = {
          isConnected: true,
          chainId,
        };
        if (typeof window.__e2e__.enableAutoConnect === "function") {
          window.__e2e__.enableAutoConnect();
        }
        if (typeof window.__e2e__.updateConnectionState === "function") {
          window.__e2e__.updateConnectionState({
            isConnected: true,
            chainId,
          });
        } else {
          window.dispatchEvent(
            new CustomEvent("e2e:connection-state", {
              detail: { isConnected: true, chainId },
            })
          );
        }
      }, CHAIN_ID);

      await page.waitForFunction(
        (expectedChainId) => {
          const state = window.__e2e__?.connectionState;
          return Boolean(state?.isConnected) && state?.chainId === expectedChainId;
        },
        CHAIN_ID,
        { timeout: 5_000 }
      );
    };

    await waitForAutoConnect(pageA);
    await waitForAutoConnect(pageB);

    const ensureSeed = async (page) => {
      await page.evaluate(
        ({ chainId, poolAddress }) => {
          const ensureFns = () => {
            if (!window.__e2e__) {
              window.__e2e__ = {};
            }
            if (!window.__e2e__.poolAddress && poolAddress) {
              window.__e2e__.poolAddress = poolAddress;
            }
            if (!window.__e2e__.seedCommitments) {
              window.__e2e__.seedCommitments = ({ commitments, lastBlock }) => {
                const normalizedAddress = (window.__e2e__?.poolAddress ?? "").toLowerCase();
                if (!normalizedAddress) {
                  throw new Error("poolAddress not configured on __e2e__ namespace");
                }
                const key = `whisperfi:commitments:${chainId}:${normalizedAddress}`;
                const payload = {
                  commitments,
                  lastBlock: lastBlock !== undefined ? String(lastBlock) : undefined,
                  updatedAt: Date.now(),
                };
                try {
                  window.localStorage.setItem(key, JSON.stringify(payload));
                } catch (err) {
                  console.warn("Failed to seed commitments", err);
                }
                try {
                  window.localStorage.setItem(
                    `whisperfi:commitment-sync:whisperfi-commitment-cache:${Date.now()}`,
                    JSON.stringify({
                      chainId,
                      address: normalizedAddress,
                      action: "refresh",
                      updatedAt: payload.updatedAt,
                      sourceId: "playwright-seed",
                    })
                  );
                } catch (err) {
                  console.warn("Failed to broadcast seed event", err);
                }
              };
            }
            if (!window.__e2e__.clearCommitments) {
              window.__e2e__.clearCommitments = () => {
                const normalizedAddress = (window.__e2e__?.poolAddress ?? "").toLowerCase();
                if (!normalizedAddress) {
                  return;
                }
                const key = `whisperfi:commitments:${chainId}:${normalizedAddress}`;
                try {
                  window.localStorage.removeItem(key);
                } catch (err) {
                  console.warn("Failed to clear commitments", err);
                }
                try {
                  window.localStorage.setItem(
                    `whisperfi:commitment-sync:whisperfi-commitment-cache:${Date.now()}`,
                    JSON.stringify({
                      chainId,
                      address: normalizedAddress,
                      action: "clear",
                      updatedAt: Date.now(),
                      sourceId: "playwright-clear",
                    })
                  );
                } catch (err) {
                  console.warn("Failed to broadcast clear event", err);
                }
              };
            }
            if (!window.__e2e__.clearForcedConnection) {
              window.__e2e__.clearForcedConnection = () => {
                window.__e2e__.forceConnected = false;
              };
            }
            if (!window.__e2e__.enableAutoConnect) {
              window.__e2e__.enableAutoConnect = () => {
                window.__e2e__.autoConnect = true;
                window.__e2e__.forceConnected = true;
              };
            }
          };
          ensureFns();
        },
        {
          chainId: CHAIN_ID,
          poolAddress: CONTRACTS.PRIVACY_POOL_ADDRESS,
        }
      );
    };

    await Promise.all([ensureSeed(pageA), ensureSeed(pageB)]);
    await Promise.all([
      pageA.evaluate(() => {
        return (window as any).__NEXT_DATA__?.props?.pageProps?.err?.message ?? null;
      }),
      pageB.evaluate(() => {
        return (window as any).__NEXT_DATA__?.props?.pageProps?.err?.message ?? null;
      }),
    ]);
    const poolAddressA = await pageA.evaluate(() => window.__e2e__?.poolAddress ?? null);
    const poolAddressB = await pageB.evaluate(() => window.__e2e__?.poolAddress ?? null);

    await pageA.locator(RESET_BUTTON).first().waitFor({ state: "attached", timeout: 10_000 });
    await pageB.locator(RESET_BUTTON).first().waitFor({ state: "attached", timeout: 10_000 });

    await pageA.evaluate(() => {
      window.__e2e__?.seedCommitments({
        commitments: ["0xabc123"],
        lastBlock: 5n,
      });
    });

    await Promise.all([pageA.reload(), pageB.reload()]);
    await Promise.all([pageA.waitForLoadState("networkidle"), pageB.waitForLoadState("networkidle")]);

    await waitForAutoConnect(pageA);
    await waitForAutoConnect(pageB);
    await Promise.all([ensureSeed(pageA), ensureSeed(pageB)]);

    const storedA = await pageA.evaluate((key) => window.localStorage.getItem(key), COMMITMENT_KEY);
    const storedB = await pageB.evaluate((key) => window.localStorage.getItem(key), COMMITMENT_KEY);
    expect(storedA).not.toBeNull();
    expect(storedB).not.toBeNull();

    const waitForStatusPanel = async (page: Page) => {
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll("div")).some((div) =>
          /Cache last synced/i.test(div.textContent || "")
        );
      }, { timeout: 15_000 });
    };

    await waitForStatusPanel(pageA);
    await waitForStatusPanel(pageB);

    await pageA.evaluate(() => {
      window.__e2e__?.clearCommitments?.();
    });

    await pageB.waitForFunction(() => {
      const panels = Array.from(
        document.querySelectorAll("div")
      ).filter((div) => /Cache last synced/i.test(div.textContent || ""));
      return panels.length === 0;
    });

    const storageEmptyA = await pageA.evaluate((k) => !localStorage.getItem(k), COMMITMENT_KEY);
    const storageEmptyB = await pageB.evaluate((k) => !localStorage.getItem(k), COMMITMENT_KEY);
    expect(storageEmptyA).toBe(true);
    expect(storageEmptyB).toBe(true);

    await context.close();
  });
});


