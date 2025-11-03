import { expect } from "chai";
import { isAddress } from "ethers";
import { CONTRACTS } from "../../frontend/src/config/contracts";

describe("Contracts config", () => {
  const expectedKeys = [
    "PRIVACY_POOL_ADDRESS",
    "PAYMASTER_ADDRESS",
    "SMART_ACCOUNT_FACTORY_ADDRESS",
    "EXECUTOR_ADDRESS",
    "VERIFIER_ADDRESS",
    "ENTRYPOINT_ADDRESS",
    "POSEIDON_HASHER_ADDRESS",
    "POSEIDON_HASHER5_ADDRESS",
  ] as const;

  it("exposes all required addresses", () => {
    expect(Object.keys(CONTRACTS).sort()).to.deep.equal(
      [...expectedKeys].sort()
    );
  });

  it("contains valid-looking addresses", () => {
    for (const key of expectedKeys) {
      const value = CONTRACTS[key];
      expect(
        isAddress(value),
        `${key} should be a valid address but received ${value}`
      ).to.equal(true);
    }
  });
});
