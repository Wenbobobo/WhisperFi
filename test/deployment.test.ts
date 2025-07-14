// test/deployment.test.ts
import { expect } from "chai";
import { setupEnvironment } from "./environment";

describe("Deployment Test", function () {
  it("should deploy all contracts without errors", async function () {
    this.timeout(60000); // Increase timeout for deployment
    const env = await setupEnvironment();
    expect(env.entryPoint).to.not.be.undefined;
    expect(env.privacyPool).to.not.be.undefined;
    expect(env.paymaster).to.not.be.undefined;
    expect(env.factory).to.not.be.undefined;
  });
});
