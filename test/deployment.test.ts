// test/deployment.test.ts
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "./environment";

describe("Deployment Test", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("should deploy all contracts without errors", async function () {
    expect(env.entryPoint).to.not.be.undefined;
    expect(env.privacyPool).to.not.be.undefined;
    expect(env.paymaster).to.not.be.undefined;
    expect(env.factory).to.not.be.undefined;
    expect(env.verifier).to.not.be.undefined; // Also check the verifier
  });
});
