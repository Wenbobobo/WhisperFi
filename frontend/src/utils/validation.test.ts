import { describe, it, expect } from "vitest";
import { isValidRecipientAddress } from "./validation";

describe("validation utils", () => {
  it("validates EVM addresses", () => {
    expect(isValidRecipientAddress(undefined)).toBe(false);
    expect(isValidRecipientAddress(null as any)).toBe(false);
    expect(isValidRecipientAddress("0x0")).toBe(false);
    expect(
      isValidRecipientAddress("0x0000000000000000000000000000000000000000")
    ).toBe(true);
    expect(
      isValidRecipientAddress("0xa513E6E4b8f2a923D98304ec87F64353C4D5C853")
    ).toBe(true);
  });
});

