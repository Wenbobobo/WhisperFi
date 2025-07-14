// frontend/src/utils/crypto.test.ts
import { expect } from "chai";
import { generateNote, parseNote, generateCommitment, generateNullifierHash } from "./crypto";

describe("Crypto Utils", () => {
  it("should correctly generate and parse a note", () => {
    const note = generateNote();
    const { secret, nullifier } = parseNote(note);

    expect(note).to.match(/^private-defi-0x[a-f0-9]{62}-0x[a-f0-9]{62}-v1$/);
    expect(secret).to.have.length(64);
    expect(nullifier).to.have.length(64);
  });

  it("should generate a consistent commitment", async () => {
    const secret = "0x10000000000000000000000000000000000000000000000000000000000000";
    const amount = "100000000000000000"; // 0.1 ETH
    const commitment = await generateCommitment(secret, amount);

    // This is a pre-computed value for the given secret and amount, based on the circuit's Poseidon hash
    const expectedCommitment = "0x0c88bf58138d2999aecad33d77d40a5c5876adcf1a51a6cb1e96ad154efd08d9";
    expect(commitment).to.equal(expectedCommitment);
  });

  it("should generate a consistent nullifier hash", async () => {
    const secret = "0x10000000000000000000000000000000000000000000000000000000000000";
    const nullifierHash = await generateNullifierHash(secret);

    // This is a pre-computed value for the given secret, based on the circuit's Poseidon hash
    const expectedNullifierHash = "0x2753f8970ba6cc1f499ebf93074b32830eec0e0424cf2781a577a50bb2b1f7c2";
    expect(nullifierHash).to.equal(expectedNullifierHash);
  });
});
