// test/AA-E2E.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  deployTestEnvironment,
  TestEnvironment,
  generateUserOp,
  getSmartAccountClient,
} from "./environment";
import { SmartAccount } from "../typechain-types";
import { ZeroAddress, ZeroHash, getBytes } from "ethers";

describe("Account Abstraction E2E", function () {
  let env: TestEnvironment;
  let smartAccount: SmartAccount;
  let smartAccountAddress: string;

  // Before each test, we load a fresh environment using a fixture.
  // This approach is faster and ensures test isolation.
  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);

    // For each test, create a new smart account owned by the 'user'
    const { factory, user, owner } = env;
    const userAddress = await user.getAddress();

    await factory.createAccount(userAddress, 0);
    smartAccountAddress = await factory.getAccountAddress(userAddress, 0);

    // Fund the new smart account with some ETH for the tests
    await owner.sendTransaction({
      to: smartAccountAddress,
      value: ethers.parseEther("2"),
    });

    smartAccount = await getSmartAccountClient(smartAccountAddress, user);
  });

  it("should sponsor a deposit transaction into the PrivacyPool", async function () {
    const { entryPoint, privacyPool, paymaster, bundler, user } = env;
    const paymasterAddress = await paymaster.getAddress();
    const privacyPoolAddress = await privacyPool.getAddress();
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    // 1. Create the calldata for the deposit action
    const commitment = ethers.randomBytes(32);
    const depositCallData = privacyPool.interface.encodeFunctionData(
      "deposit",
      [commitment]
    );

    // 2. Create the calldata for the SmartAccount's `execute` function
    const executionCallData = smartAccount.interface.encodeFunctionData(
      "execute",
      [privacyPoolAddress, depositAmount, depositCallData]
    );

    // 3. Generate the signed UserOperation using the helper function
    const userOp = await generateUserOp(
      env,
      smartAccountAddress,
      executionCallData
    );

    // 4. Get initial state for verification
    const initialRoot = await privacyPool.merkleRoot();
    const initialPaymasterBalance = await entryPoint.balanceOf(
      paymasterAddress
    );
    const initialAccountBalance = await ethers.provider.getBalance(
      smartAccountAddress
    );

    // 5. Submit the UserOperation via the bundler
    const tx = await entryPoint
      .connect(bundler)
      .handleOps([userOp], await bundler.getAddress());
    const receipt = await tx.wait();

    // Find the Deposit event to confirm success
    const depositEvent = receipt?.logs
      .map((log) => {
        try {
          return privacyPool.interface.parseLog(log as any);
        } catch (e) {
          return null;
        }
      })
      .find((event) => event?.name === "Deposit");

    // 6. Verify the results
    const finalRoot = await privacyPool.merkleRoot();
    const finalPaymasterBalance = await entryPoint.balanceOf(paymasterAddress);
    const finalAccountBalance = await ethers.provider.getBalance(
      smartAccountAddress
    );

    // Assertions
    expect(depositEvent).to.not.be.undefined;
    expect(finalRoot).to.not.equal(
      initialRoot,
      "Privacy pool root should change after deposit"
    );
    expect(finalPaymasterBalance).to.be.lessThan(
      initialPaymasterBalance,
      "Paymaster should pay for gas"
    );
    expect(finalAccountBalance).to.be.lessThan(
      initialAccountBalance,
      "Account should pay the deposit amount"
    );
  });

  it("should reject unsupported targets", async function () {
    const { entryPoint, paymaster, bundler } = env;

    // Create calldata to call an unsupported target (the account itself)
    const callData = smartAccount.interface.encodeFunctionData("execute", [
      smartAccountAddress, // Target is the account itself, which is not supported by the paymaster
      0,
      "0x",
    ]);

    // Generate the UserOperation
    const userOp = await generateUserOp(env, smartAccountAddress, callData);

    // This should fail because the target is not in the paymaster's supported list
    await expect(
      entryPoint
        .connect(bundler)
        .handleOps([userOp], await bundler.getAddress())
    )
      .to.be.revertedWithCustomError(entryPoint, "FailedOpWithRevert")
      .withArgs(
        0,
        "AA33 reverted",
        paymaster.interface.encodeErrorResult("UnsupportedTarget")
      );
  });

  it("should reject expired UserOperations", async function () {
    const { entryPoint, privacyPool, paymaster, bundler } = env;
    const privacyPoolAddress = await privacyPool.getAddress();
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    // Create calldata for a valid deposit action
    const commitment = ethers.randomBytes(32);
    const depositCallData = privacyPool.interface.encodeFunctionData(
      "deposit",
      [commitment]
    );
    const executionCallData = smartAccount.interface.encodeFunctionData(
      "execute",
      [privacyPoolAddress, depositAmount, depositCallData]
    );

    // Create expired time parameters
    const currentBlock = await ethers.provider.getBlock("latest");
    const expiredTimestamp = currentBlock!.timestamp - 3600; // 1 hour ago

    // Manually create expired paymasterAndData
    const paymasterAndData = await paymaster.createPaymasterAndData(
      100000,
      50000,
      expiredTimestamp, // validUntil is in the past
      0
    );

    // Generate UserOp, overriding with the expired paymasterAndData
    const userOp = await generateUserOp(
      env,
      smartAccountAddress,
      executionCallData,
      {
        paymasterAndData: paymasterAndData,
      }
    );

    // This should fail because the UserOperation's timestamp is invalid
    await expect(
      entryPoint
        .connect(bundler)
        .handleOps([userOp], await bundler.getAddress())
    )
      .to.be.revertedWithCustomError(entryPoint, "FailedOpWithRevert")
      .withArgs(
        0,
        "AA33 reverted",
        paymaster.interface.encodeErrorResult("InvalidTimestamp")
      );
  });
});
