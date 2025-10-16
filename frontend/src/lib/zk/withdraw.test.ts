import { describe, it, expect } from "vitest";
import { buildWithdrawInputs, poseidon2 } from "./withdraw";

describe("zk withdraw utils", () => {
  it("builds withdraw inputs with bigint coercion", async () => {
    const secret = "0x01";
    const amount = "100000000000000000"; // 0.1 ETH
    const proof = {
      pathElements: ["0x01", 2n, "3"],
      pathIndices: [0, 1, 0],
      root: "0x04",
    };
    const nullifier = "0x05";
    const input = await buildWithdrawInputs(secret, amount, proof, nullifier);
    expect(input.secret).toBeTypeOf("bigint");
    expect(input.amount).toBeTypeOf("bigint");
    expect(input.merkleRoot).toBeTypeOf("bigint");
    expect(input.nullifier).toBeTypeOf("bigint");
    expect(input.pathElements.every((x) => typeof x === "bigint")).toBe(true);
  });

  it("computes poseidon2 and returns bigint", async () => {
    const h = await poseidon2([1n, 2n]);
    expect(typeof h).toBe("bigint");
  });
});

