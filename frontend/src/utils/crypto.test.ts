// frontend/src/utils/crypto.test.ts
import { describe, it, expect } from "vitest";
import {
  generateNote,
  parseNote,
  generateCommitment,
  generateNullifierHash,
} from "./crypto";

describe("Crypto Utils", () => {
  it("should correctly generate and parse a note", () => {
    const note = generateNote();
    const { secret, nullifier } = parseNote(note);

    expect(note).toMatch(/^private-defi-[0-9a-f]{62}-[0-9a-f]{62}-v1$/);
    expect(secret).toHaveLength(64);
    expect(nullifier).toHaveLength(64);
  });

  it("should generate a consistent commitment", async () => {
    const secret =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const amount = "100000000000000000"; // 0.1 ETH
    const commitment = await generateCommitment(secret, amount);

    // Commitment should be deterministic for the same secret and amount
    expect(commitment).toMatch(/^0x[0-9a-fA-F]{64}$/);

    // Test consistency - same inputs should produce same output
    const commitment2 = await generateCommitment(secret, amount);
    expect(commitment).toEqual(commitment2);
  });

  it("should generate different commitments for different amounts", async () => {
    const secret =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const amount1 = "100000000000000000"; // 0.1 ETH
    const amount2 = "200000000000000000"; // 0.2 ETH

    const commitment1 = await generateCommitment(secret, amount1);
    const commitment2 = await generateCommitment(secret, amount2);

    expect(commitment1).not.toEqual(commitment2);
    expect(commitment1).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(commitment2).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should generate different commitments for different secrets", async () => {
    const secret1 =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const secret2 =
      "0x20000000000000000000000000000000000000000000000000000000000000";
    const amount = "100000000000000000"; // 0.1 ETH

    const commitment1 = await generateCommitment(secret1, amount);
    const commitment2 = await generateCommitment(secret2, amount);

    expect(commitment1).not.toEqual(commitment2);
    expect(commitment1).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(commitment2).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should generate a consistent nullifier hash", async () => {
    const secret =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const nullifierHash = await generateNullifierHash(secret);

    // Nullifier hash should be deterministic for the same secret
    expect(nullifierHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

    // Test consistency - same input should produce same output
    const nullifierHash2 = await generateNullifierHash(secret);
    expect(nullifierHash).toEqual(nullifierHash2);
  });

  it("should generate different nullifier hashes for different secrets", async () => {
    const secret1 =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const secret2 =
      "0x20000000000000000000000000000000000000000000000000000000000000";

    const nullifierHash1 = await generateNullifierHash(secret1);
    const nullifierHash2 = await generateNullifierHash(secret2);

    expect(nullifierHash1).not.toEqual(nullifierHash2);
    expect(nullifierHash1).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(nullifierHash2).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });
});
