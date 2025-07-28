// frontend/src/utils/crypto.test.ts
import { expect } from "chai";
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

    expect(note).to.match(/^private-defi-0x[a-f0-9]{62}-0x[a-f0-9]{62}-v1$/);
    expect(secret).to.have.length(64);
    expect(nullifier).to.have.length(64);
  });

  it("should generate a consistent commitment", async () => {
    const secret =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const amount = "100000000000000000"; // 0.1 ETH
    const commitment = await generateCommitment(secret, amount);

    // Commitment should be deterministic for the same secret and amount
    expect(commitment).to.match(/^0x[0-9a-fA-F]{64}$/);

    // Test consistency - same inputs should produce same output
    const commitment2 = await generateCommitment(secret, amount);
    expect(commitment).to.equal(commitment2);
  });

  it("should generate different commitments for different amounts", async () => {
    const secret =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const amount1 = "100000000000000000"; // 0.1 ETH
    const amount2 = "200000000000000000"; // 0.2 ETH

    const commitment1 = await generateCommitment(secret, amount1);
    const commitment2 = await generateCommitment(secret, amount2);

    expect(commitment1).to.not.equal(commitment2);
    expect(commitment1).to.match(/^0x[0-9a-fA-F]{64}$/);
    expect(commitment2).to.match(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should generate different commitments for different secrets", async () => {
    const secret1 =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const secret2 =
      "0x20000000000000000000000000000000000000000000000000000000000000";
    const amount = "100000000000000000"; // 0.1 ETH

    const commitment1 = await generateCommitment(secret1, amount);
    const commitment2 = await generateCommitment(secret2, amount);

    expect(commitment1).to.not.equal(commitment2);
    expect(commitment1).to.match(/^0x[0-9a-fA-F]{64}$/);
    expect(commitment2).to.match(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should generate a consistent nullifier hash", async () => {
    const secret =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const nullifierHash = await generateNullifierHash(secret);

    // Nullifier hash should be deterministic for the same secret
    expect(nullifierHash).to.match(/^0x[0-9a-fA-F]{64}$/);

    // Test consistency - same input should produce same output
    const nullifierHash2 = await generateNullifierHash(secret);
    expect(nullifierHash).to.equal(nullifierHash2);
  });

  it("should generate different nullifier hashes for different secrets", async () => {
    const secret1 =
      "0x10000000000000000000000000000000000000000000000000000000000000";
    const secret2 =
      "0x20000000000000000000000000000000000000000000000000000000000000";

    const nullifierHash1 = await generateNullifierHash(secret1);
    const nullifierHash2 = await generateNullifierHash(secret2);

    expect(nullifierHash1).to.not.equal(nullifierHash2);
    expect(nullifierHash1).to.match(/^0x[0-9a-fA-F]{64}$/);
    expect(nullifierHash2).to.match(/^0x[0-9a-fA-F]{64}$/);
  });
});
