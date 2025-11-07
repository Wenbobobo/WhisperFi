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
    expect(window.__e2e__?.connectionState).toEqual({
      isConnected: false,
      chainId: null,
    });
  });

  it("records connection state updates", () => {
    const handler = vi.fn();
    window.addEventListener("e2e:connection-state", handler as unknown as EventListener);
    window.__e2e__?.updateConnectionState?.({
      isConnected: true,
      chainId: 31337,
    });
    expect(window.__e2e__?.connectionState).toEqual({
      isConnected: true,
      chainId: 31337,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("e2e:connection-state", handler as unknown as EventListener);
  });

  it("seeds and clears commitments through helpers", () => {
    const poolAddress = "0x2279B7A0A67DB372996A5FAB50D91EAA73D2EBE6";
    window.__e2e__?.setPoolAddress?.(poolAddress);

    const storageKey = `whisperfi:commitments:31337:${poolAddress.toLowerCase()}`;
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    window.__e2e__?.seedCommitments?.({
      commitments: ["0xabc123"],
      lastBlock: 5n,
    });

    const stored = window.localStorage.getItem(storageKey);
    expect(stored).not.toBeNull();

    expect(typeof window.__e2e__?.clearCommitments).toBe("function");
    window.__e2e__?.clearCommitments?.();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
