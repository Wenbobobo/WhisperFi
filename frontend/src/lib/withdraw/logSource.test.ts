import { describe, it, expect, vi } from "vitest";
import { createDepositLogLoader, createResettableDepositLogLoader } from "./logSource";

const depositEvent = {
  type: "event" as const,
  name: "Deposit",
  inputs: [
    { type: "bytes32", name: "commitment", indexed: true },
    { type: "uint32", name: "leafIndex", indexed: false },
    { type: "uint256", name: "timestamp", indexed: false },
  ],
};

const createSyncHarness = () => {
  const subscribers: Array<(event: { chainId: number; address: string; action: "refresh" | "clear"; updatedAt?: number; sourceId: string }) => void> = [];
  return {
    sync: {
      publish: vi.fn(),
      subscribe: vi.fn((handler: (event: { chainId: number; address: string; action: "refresh" | "clear"; updatedAt?: number; sourceId: string }) => void) => {
        subscribers.push(handler);
        return () => {
          const idx = subscribers.indexOf(handler);
          if (idx >= 0) {
            subscribers.splice(idx, 1);
          }
        };
      }),
      getSourceId: () => "test-source",
    },
    emit: (event: { chainId: number; address: string; action: "refresh" | "clear"; updatedAt?: number; sourceId: string }) => {
      subscribers.forEach((handler) => handler(event));
    },
    subscribers,
  };
};

describe("createDepositLogLoader", () => {
  it("returns commitments from initial fetch", async () => {
    const getLogs = vi.fn().mockResolvedValue([
      { args: { commitment: "0x1" }, blockNumber: 10n },
      { args: { commitment: "0x2" }, blockNumber: 11n },
    ]);
    const load = createDepositLogLoader();

    const result = await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    expect(result.commitments).toEqual(["0x1", "0x2"]);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: "earliest" })
    );
  });

  it("caches results and exposes cache status", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([
        { args: { commitment: "0x1" }, blockNumber: 5n },
        { args: { commitment: "0x2" }, blockNumber: 6n },
      ])
      .mockResolvedValueOnce([
        { args: { commitment: "0x3" }, blockNumber: 8n },
      ]);
    const load = createDepositLogLoader();

    const first = await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });
    expect(first.commitments).toEqual(["0x1", "0x2"]);

    const second = await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });
    expect(second.commitments).toEqual(["0x1", "0x2", "0x3"]);
    expect(getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: 7n })
    );

    const status = load.getCacheStatus("0xPool");
    expect(status).toBeDefined();
    expect(status?.lastBlock).toBe(8n);
    expect(status?.lastSyncedAt).toBeGreaterThanOrEqual(now);
    expect(status?.commitmentCount).toBe(3);

    vi.useRealTimers();
  });

  it("falls back to cache when no new logs arrive", async () => {
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([{ args: { commitment: "0xaaa" }, blockNumber: 2n }])
      .mockResolvedValueOnce([]);
    const load = createDepositLogLoader();

    const first = await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });
    expect(first.commitments).toEqual(["0xaaa"]);

    const second = await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });
    expect(second.commitments).toEqual(["0xaaa"]);
    expect(getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: 3n })
    );
  });
  it("loads persisted entry before fetching new logs", async () => {
    const persisted = { commitments: ["0xpersist"], lastBlock: 12n };
    const loadPersisted = vi.fn().mockResolvedValue(persisted);
    const savePersisted = vi.fn();
    const getLogs = vi.fn().mockResolvedValue([]);

    const load = createDepositLogLoader({
      load: loadPersisted,
      save: savePersisted,
    });

    const result = await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    expect(loadPersisted).toHaveBeenCalledWith("0xpool");
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 13n })
    );
    expect(savePersisted).toHaveBeenCalledWith(
      "0xpool",
      expect.objectContaining({
        commitments: ["0xpersist"],
        lastBlock: 12n,
        commitmentCount: 1,
      })
    );
    expect(result.commitments).toEqual(["0xpersist"]);
  });
});

describe("deposit loader cache sync integration", () => {
  it("publishes refresh events after storing new commitments", async () => {
    const harness = createSyncHarness();
    const getLogs = vi.fn().mockResolvedValue([
      { args: { commitment: "0x1" }, blockNumber: 4n },
    ]);

    const load = createDepositLogLoader(
      {
        save: vi.fn(),
        chainId: 5,
      },
      harness.sync as any
    );

    await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    expect(harness.sync.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 5,
        address: "0xpool",
        action: "refresh",
        updatedAt: expect.any(Number),
      })
    );
  });

  it("clears local cache when receiving external clear events", async () => {
    const harness = createSyncHarness();
    const clearPersisted = vi.fn();
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([{ args: { commitment: "0xa" }, blockNumber: 2n }])
      .mockResolvedValueOnce([{ args: { commitment: "0xb" }, blockNumber: 3n }]);

    const load = createDepositLogLoader(
      {
        save: vi.fn(),
        clear: clearPersisted,
        chainId: 6,
      },
      harness.sync as any
    );

    await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    harness.emit({
      chainId: 6,
      address: "0xpool",
      action: "clear",
      updatedAt: Date.now(),
      sourceId: "remote",
    });

    await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    expect(clearPersisted).toHaveBeenCalledWith("0xpool");
    expect(getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: "earliest" })
    );
  });

  it("reloads persisted data when receiving refresh events", async () => {
    const harness = createSyncHarness();
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([{ args: { commitment: "0x1" }, blockNumber: 4n }])
      .mockResolvedValueOnce([]);

    let persisted:
      | { commitments: string[]; lastBlock?: bigint; lastSyncedAt?: number; expiresAt?: number }
      | undefined;

    const persist = {
      save: vi.fn(async (_key: string, entry: any) => {
        persisted = { ...entry };
      }),
      load: vi.fn(async () => (persisted ? { ...persisted } : undefined)),
      clear: vi.fn(),
      chainId: 7,
    };

    const load = createDepositLogLoader(persist as any, harness.sync as any);

    await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    persisted = {
      commitments: ["0x1", "0x2"],
      lastBlock: 9n,
      lastSyncedAt: Date.now(),
      expiresAt: Date.now() + 1_000,
    };

    harness.emit({
      chainId: 7,
      address: "0xpool",
      action: "refresh",
      updatedAt: Date.now(),
      sourceId: "remote",
    });

    await load({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    expect(persist.load).toHaveBeenCalledWith("0xpool");
    expect(getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: 10n })
    );
  });
});

describe("createResettableDepositLogLoader", () => {
  it("clears both persisted and in-memory cache", async () => {
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([
        { args: { commitment: "0x1" }, blockNumber: 4n },
        { args: { commitment: "0x2" }, blockNumber: 5n },
      ])
      .mockResolvedValueOnce([
        { args: { commitment: "0x1" }, blockNumber: 4n },
        { args: { commitment: "0x2" }, blockNumber: 5n },
        { args: { commitment: "0x3" }, blockNumber: 6n },
      ]);

    const clearPersisted = vi.fn();

    const loader = createResettableDepositLogLoader({
      clear: clearPersisted,
    });

    const first = await loader.loadCommitments({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });
    expect(first.commitments).toEqual(["0x1", "0x2"]);

    await loader.clear("0xPool");
    expect(clearPersisted).toHaveBeenCalledWith("0xpool");
    expect(loader.loadCommitments.getCacheStatus("0xPool")).toBeUndefined();

    const second = await loader.loadCommitments({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    expect(second.commitments).toEqual(["0x1", "0x2", "0x3"]);
    expect(getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: "earliest" })
    );
  });

  it("broadcasts clear events when manual clear is invoked", async () => {
    const harness = createSyncHarness();
    const clearPersisted = vi.fn();

    const loader = createResettableDepositLogLoader(
      {
        clear: clearPersisted,
        chainId: 11,
      },
      harness.sync as any
    );

    await loader.clear("0xPool");

    expect(clearPersisted).toHaveBeenCalledWith("0xpool");
    expect(harness.sync.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 11,
        address: "0xpool",
        action: "clear",
        updatedAt: expect.any(Number),
      })
    );
  });

  it("evicts expired cache entries when ttl elapses", async () => {
    vi.useFakeTimers();

    const ttlMs = 1000;
    let stored:
      | { commitments: string[]; lastBlock?: bigint; savedAt: number }
      | undefined;

    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([
        { args: { commitment: "0xa" }, blockNumber: 7n },
      ])
      .mockResolvedValueOnce([
        { args: { commitment: "0xa" }, blockNumber: 7n },
        { args: { commitment: "0xb" }, blockNumber: 8n },
      ]);

    const loadPersisted = vi.fn(async () => {
      if (!stored) {
        return undefined;
      }
      if (Date.now() - stored.savedAt > ttlMs) {
        stored = undefined;
        return undefined;
      }
      return {
        commitments: [...stored.commitments],
        lastBlock: stored.lastBlock,
        expiresAt: stored.savedAt + ttlMs,
      };
    });

    const savePersisted = vi.fn(async (_key: string, entry: any) => {
      stored = {
        commitments: [...entry.commitments],
        lastBlock: entry.lastBlock,
        savedAt: Date.now(),
      };
    });

    const clearPersisted = vi.fn(async () => {
      stored = undefined;
    });

    const loader = createDepositLogLoader({
      load: loadPersisted,
      save: savePersisted,
      clear: clearPersisted,
      ttlMs,
    });

    const first = await loader({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });
    expect(first.commitments).toEqual(["0xa"]);

    vi.advanceTimersByTime(ttlMs + 10);

    const second = await loader({
      publicClient: { getLogs } as any,
      address: "0xPool",
      event: depositEvent,
    });

    expect(getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: "earliest" })
    );
    expect(second.commitments).toEqual(["0xa", "0xb"]);
    expect(clearPersisted).toHaveBeenCalledWith("0xpool");
    expect(loader.getCacheStatus("0xPool")?.commitmentCount).toBe(2);

    vi.advanceTimersByTime(ttlMs + 10);
    expect(loader.getCacheStatus("0xPool")).toBeUndefined();

    vi.useRealTimers();
  });
});
