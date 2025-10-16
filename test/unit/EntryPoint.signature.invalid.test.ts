import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment, generateUserOp, getSmartAccountClient } from "../environment";

describe("EntryPoint signature validation", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("reverts UserOperation with invalid signature", async function () {
    const { factory, user, owner, entryPoint, privacyPool, bundler } = env;
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

    // generate a valid userOp, then corrupt signature
    const userOp = await generateUserOp(env, smartAccountAddress, execCallData);
    userOp.signature = "0x11"; // deliberately invalid

    await expect(
      entryPoint.connect(bundler).handleOps([userOp], await bundler.getAddress())
    ).to.be.reverted; // different ERC-4337 versions emit different custom errors; generic revert is acceptable here
  });
});

