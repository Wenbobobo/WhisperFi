import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment, generateUserOp, getSmartAccountClient } from "../environment";

describe("Paymaster time window validation", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("reverts when validAfter is in the future", async function () {
    const { factory, user, owner, entryPoint, privacyPool, bundler, paymaster } = env;
    const userAddress = await user.getAddress();
    await factory.createAccount(userAddress, 0);
    const smartAccountAddress = await factory.getAccountAddress(userAddress, 0);
    const smartAccount = await getSmartAccountClient(smartAccountAddress, user);

    // fund account for deposit
    await owner.sendTransaction({ to: smartAccountAddress, value: ethers.parseEther("1") });

    const commitment = ethers.randomBytes(32);
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    const depositCallData = privacyPool.interface.encodeFunctionData("deposit", [commitment]);
    const execCallData = smartAccount.interface.encodeFunctionData("execute", [await privacyPool.getAddress(), depositAmount, depositCallData]);

    // Build a paymasterAndData with validAfter > block.timestamp
    const currentBlock = await ethers.provider.getBlock("latest");
    const validAfter = currentBlock!.timestamp + 3600; // 1 hour in the future
    const validUntil = 0; // no upper bound
    const pmd = await paymaster.createPaymasterAndData(100000, 50000, validUntil, validAfter);

    const userOp = await generateUserOp(env, smartAccountAddress, execCallData, { paymasterAndData: pmd });

    await expect(
      entryPoint.connect(bundler).handleOps([userOp], await bundler.getAddress())
    ).to.be.reverted; // Paymaster should reject due to timestamp window
  });
});

