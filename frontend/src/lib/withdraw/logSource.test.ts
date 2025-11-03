import { describe, it, expect, vi } from "vitest";
import { createDepositLogLoader } from "./logSource";

const depositEvent = {
  type: "event" as const,
  name: "Deposit",
  inputs: [
    { type: "bytes32", name: "commitment", indexed: true },
    { type: "uint32", name: "leafIndex", indexed: false },
    { type: "uint256", name: "timestamp", indexed: false },
  ],
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

  it("caches results and only fetches new logs", async () => {
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
});
