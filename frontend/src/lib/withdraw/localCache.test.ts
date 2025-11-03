import { describe, it, expect, beforeEach, vi } from "vitest";
import { createLocalStoragePersistor } from "./localCache";

describe("createLocalStoragePersistor", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("persists and restores cache entries", () => {
    const chainId = 11155111;
    const persistor = createLocalStoragePersistor({ chainId });
    const key = "0xpool";

    const entry = {
      commitments: ["0x1", "0x2"],
      lastBlock: 123n,
    };

    persistor.save?.(key, entry);

    const restored = persistor.load?.(key);
    expect(restored).toEqual({
      commitments: ["0x1", "0x2"],
      lastBlock: 123n,
    });
  });

  it("enforces commitment limit when saving", () => {
    const persistor = createLocalStoragePersistor({
      chainId: 1,
      maxCommitments: 3,
    });
    const key = "0xpool";

    persistor.save?.(key, {
      commitments: ["a", "b", "c", "d"],
      lastBlock: 5n,
    });

    const restored = persistor.load?.(key);
    expect(restored?.commitments).toEqual(["b", "c", "d"]);
  });

  it("clears stored entry", () => {
    const persistor = createLocalStoragePersistor({ chainId: 5 });
    const key = "0xpool";

    persistor.save?.(key, {
      commitments: ["x"],
    });
    expect(persistor.load?.(key)?.commitments).toEqual(["x"]);

    persistor.clear?.(key);
    expect(persistor.load?.(key)).toBeUndefined();
  });

  it("drops stale entries when ttl has expired", () => {
    const persistor = createLocalStoragePersistor({ chainId: 1, ttlMs: 1000 });
    const key = "0xpool";

    persistor.save?.(key, {
      commitments: ["stale"],
      lastBlock: 10n,
    });

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(Date.now() + 2000);

    expect(persistor.load?.(key)).toBeUndefined();
    nowSpy.mockRestore();
  });
});
