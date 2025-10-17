import { describe, it, expect } from "vitest";
import { toWithdrawArgs } from "./submit";

describe("zk submit utils", () => {
  it("formats proof and public signals into withdraw args", () => {
    const proof = {
      pi_a: [1n, 2n],
      pi_b: [ [3n, 4n], [5n, 6n] ],
      pi_c: [7n, 8n],
    } as const;
    const publicSignals = [1n, 2n];
    const recipient = "0x1111111111111111111111111111111111111111" as const;
    const fee = 0n;
    const relayer = "0x0000000000000000000000000000000000000000" as const;

    const args = toWithdrawArgs(proof as any, publicSignals as any, recipient, fee, relayer);
    expect(args.length).toBe(8);
    const [a, b, c, rootBytes32, nullifierBytes32, rcp, feeOut, relayerOut] = args as any[];
    expect(a).toEqual(["1", "2"]);
    expect(b).toEqual([["3", "4"], ["5", "6"]]);
    expect(c).toEqual(["7", "8"]);
    expect(rootBytes32).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(nullifierBytes32).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(rcp).toBe(recipient);
    expect(feeOut).toBe(fee);
    expect(relayerOut).toBe(relayer);
  });
});

