import { beforeEach, describe, expect, it, vi } from "vitest";

describe("e2e helpers namespace", () => {
  beforeEach(async () => {
    vi.resetModules();
    delete (window as any).__e2e__;
    await import("./helpers");
  });

  it("enables auto-connect without forcing connection state", () => {
    window.__e2e__?.enableAutoConnect?.();
    expect(window.__e2e__?.autoConnect).toBe(true);
    expect(window.__e2e__?.forceConnected).toBe(false);
  });

  it("records connection state updates", () => {
    window.__e2e__?.updateConnectionState?.({
      isConnected: true,
      chainId: 31337,
    });
    expect(window.__e2e__?.connectionState).toEqual({
      isConnected: true,
      chainId: 31337,
    });
  });
});
