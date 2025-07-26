// test/debug-deploy.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "./environment";
import { ZeroAddress } from "ethers";

describe("Debug Deployment", function () {
  let env: TestEnvironment;

  // Before each test, load a fresh environment using a fixture.
  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("should deploy all core contracts successfully", async function () {
    const { entryPoint, verifier, privacyPool, factory, paymaster } = env;

    // Assert that all contract instances are not null or undefined
    expect(entryPoint).to.not.be.null;
    expect(verifier).to.not.be.null;
    expect(privacyPool).to.not.be.null;
    expect(factory).to.not.be.null;
    expect(paymaster).to.not.be.null;

    // Assert that all contracts have valid addresses
    expect(await entryPoint.getAddress()).to.not.equal(ZeroAddress);
    expect(await verifier.getAddress()).to.not.equal(ZeroAddress);
    expect(await privacyPool.getAddress()).to.not.equal(ZeroAddress);
    expect(await factory.getAddress()).to.not.equal(ZeroAddress);
    expect(await paymaster.getAddress()).to.not.equal(ZeroAddress);
  });
});