import { describe, it, expect } from "vitest";
import { buildWithdrawCircuitInputs } from "./builder";

describe("zk builder utils", () => {
  it("builds merkle proof and circuit input for a single-leaf tree", async () => {
    const secret = "0x11";
    const amount = "100000000000000000"; // 0.1 ETH
    const commitment = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const zero = "5738151709701895985996174429509233181681189240650583716378205449277091542814";
    const { input, merkle, nullifierHex } = await buildWithdrawCircuitInputs(
      secret,
      amount,
      [commitment],
      0,
      zero,
      16
    );

    expect(typeof input.secret).toBe("bigint");
    expect(typeof input.amount).toBe("bigint");
    expect(Array.isArray(merkle.pathElements)).toBe(true);
    expect(merkle.pathElements.length).toBe(16);
    expect(merkle.pathIndices.length).toBe(16);
    expect(merkle.root).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(nullifierHex).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });
});

