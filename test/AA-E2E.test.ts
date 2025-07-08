// test/AA-E2E.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

// Define PackedUserOperation interface matching the Solidity struct
interface PackedUserOperation {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  accountGasLimits: string; // bytes32 packed value
  preVerificationGas: bigint;
  gasFees: string; // bytes32 packed value
  paymasterAndData: string;
  signature: string;
}

// Helper function to pack two uint128 values into bytes32
const packUints = (high: bigint, low: bigint): string => {
  const highHex = high.toString(16).padStart(32, '0');
  const lowHex = low.toString(16).padStart(32, '0');
  return '0x' + highHex + lowHex;
};

describe("Account Abstraction E2E", function () {
  let owner: Signer, user: Signer, bundler: Signer;
  let entryPoint: any;
  let paymaster: any;
  let privacyPool: any;
  let testAccount: any;
  let verifier: any;

  beforeEach(async function () {
    [owner, user, bundler] = await ethers.getSigners();

    // Deploy EntryPoint
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();

    // Deploy Verifier
    const Verifier = await ethers.getContractFactory("Verifier");
    verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    // Deploy PrivacyPool
    const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
    privacyPool = await PrivacyPool.deploy(
      await verifier.getAddress(),
      ethers.ZeroHash,
      await owner.getAddress()
    );
    await privacyPool.waitForDeployment();

    // Deploy TestAccount
    const TestAccount = await ethers.getContractFactory("TestAccount");
    testAccount = await TestAccount.deploy(
      await entryPoint.getAddress(),
      await user.getAddress()
    );
    await testAccount.waitForDeployment();

    // Fund the test account
    await owner.sendTransaction({
      to: await testAccount.getAddress(),
      value: ethers.parseEther("1")
    });

    // Deploy Paymaster
    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = await Paymaster.deploy(
      await entryPoint.getAddress(),
      await owner.getAddress()
    );
    await paymaster.waitForDeployment();

    // Configure and fund the Paymaster
    await paymaster.connect(owner).setSupportedTarget(await privacyPool.getAddress(), true);
    await paymaster.connect(owner).depositToEntryPoint({ value: ethers.parseEther("1") });
  });

  it("should sponsor a deposit transaction into the PrivacyPool", async function () {
    const testAccountAddress = await testAccount.getAddress();
    const paymasterAddress = await paymaster.getAddress();
    const privacyPoolAddress = await privacyPool.getAddress();

    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    // 1. Create the deposit call data
    const commitment = ethers.randomBytes(32);
    const depositCallData = privacyPool.interface.encodeFunctionData("deposit", [commitment]);

    // 2. Create the execution call data for the TestAccount's `execute` function
    const executionCallData = testAccount.interface.encodeFunctionData("execute", [
      privacyPoolAddress,
      depositAmount, // value
      depositCallData,
    ]);

    // 3. Create time parameters
    const validAfter = Math.floor(Date.now() / 1000) - 60; // Valid from 1 minute ago
    const validUntil = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour

    // 4. Create paymasterAndData
    const paymasterAndData = await paymaster.createPaymasterAndData(
      100000,  // verificationGasLimit
      50000,   // postOpGasLimit
      validUntil,
      validAfter
    );

    // 5. 确保 TestAccount 有足够的 ETH
    const requiredBalance = depositAmount + ethers.parseEther("0.1");
    const currentBalance = await ethers.provider.getBalance(testAccountAddress);
    if (currentBalance < requiredBalance) {
      await owner.sendTransaction({
        to: testAccountAddress,
        value: requiredBalance - currentBalance
      });
    }

    // 6. Create the UserOperation
    const userOp: PackedUserOperation = {
      sender: testAccountAddress,
      nonce: 0n,
      initCode: "0x",
      callData: executionCallData,
      accountGasLimits: packUints(500000n, 1000000n), // 增加 gas limits
      preVerificationGas: 21000n,
      gasFees: packUints(1000000000n, 2000000000n), // maxPriorityFeePerGas, maxFeePerGas
      paymasterAndData: paymasterAndData,
      signature: "0x"
    };

    // 7. Sign the UserOperation
    const userOpHash = await entryPoint.getUserOpHash(userOp);
    const signature = await user.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    // 8. Get initial state
    const initialRoot = await privacyPool.root();
    const initialPaymasterBalance = await entryPoint.balanceOf(paymasterAddress);
    const initialAccountBalance = await ethers.provider.getBalance(testAccountAddress);

    console.log("Initial privacy pool root:", initialRoot);
    console.log("Initial paymaster balance:", ethers.formatEther(initialPaymasterBalance));
    console.log("Initial account balance:", ethers.formatEther(initialAccountBalance));
    console.log("Deposit amount:", ethers.formatEther(depositAmount));

    // 9. Submit the UserOperation
    const tx = await entryPoint.connect(bundler).handleOps([userOp], await bundler.getAddress());
    const receipt = await tx.wait();

    console.log("Transaction hash:", receipt.hash);
    console.log("Gas used:", receipt.gasUsed.toString());

    // 10. 检查交易日志
    const logs = receipt.logs;
    console.log("Transaction logs:", logs.length);
    let depositEventFound = false;
    
    for (let i = 0; i < logs.length; i++) {
      try {
        const parsedLog = privacyPool.interface.parseLog(logs[i]);
        console.log(`Privacy pool event ${i}:`, parsedLog.name, parsedLog.args);
        if (parsedLog.name === "Deposit") {
          depositEventFound = true;
        }
      } catch (e) {
        // 不是 PrivacyPool 的事件，忽略
      }
    }

    // 11. Verify the results
    const finalRoot = await privacyPool.root();
    const finalPaymasterBalance = await entryPoint.balanceOf(paymasterAddress);
    const finalAccountBalance = await ethers.provider.getBalance(testAccountAddress);

    console.log("Final privacy pool root:", finalRoot);
    console.log("Final paymaster balance:", ethers.formatEther(finalPaymasterBalance));
    console.log("Final account balance:", ethers.formatEther(finalAccountBalance));
    console.log("Deposit event found:", depositEventFound);

    // Assertions
    expect(depositEventFound).to.be.true;
    expect(finalRoot).to.not.equal(initialRoot, "Privacy pool root should change after deposit");
    expect(finalPaymasterBalance).to.be.lessThan(initialPaymasterBalance, "Paymaster should pay for gas");
    expect(finalAccountBalance).to.be.lessThan(initialAccountBalance, "Account should pay deposit amount");

    console.log(`✅ Test passed! Paymaster sponsored the transaction.`);
    console.log(`   Gas cost: ${ethers.formatEther(initialPaymasterBalance - finalPaymasterBalance)} ETH`);
  });

  it("should reject unsupported targets", async function () {
    const testAccountAddress = await testAccount.getAddress();
    
    // Create a call to an unsupported target (the test account itself) using the `execute` function
    const callData = testAccount.interface.encodeFunctionData("execute", [
      testAccountAddress, // The target is an unsupported contract
      0,
      "0x",
    ]);

    const validAfter = Math.floor(Date.now() / 1000) - 60;
    const validUntil = Math.floor(Date.now() / 1000) + 3600;

    const paymasterAndData = await paymaster.createPaymasterAndData(
      100000,
      50000,
      validUntil,
      validAfter
    );

    const userOp: PackedUserOperation = {
      sender: testAccountAddress,
      nonce: 0n,
      initCode: "0x",
      callData: callData,
      accountGasLimits: packUints(100000n, 200000n),
      preVerificationGas: 21000n,
      gasFees: packUints(1000000000n, 2000000000n),
      paymasterAndData: paymasterAndData,
      signature: "0x"
    };

    const userOpHash = await entryPoint.getUserOpHash(userOp);
    const signature = await user.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    // This should fail because the target is not supported
    await expect(
      entryPoint.connect(bundler).handleOps([userOp], await bundler.getAddress())
    ).to.be.revertedWithCustomError(entryPoint, "FailedOpWithRevert")
     .withArgs(
        0, 
        "AA33 reverted", 
        paymaster.interface.encodeErrorResult("UnsupportedTarget")
    );
  });

  it("should reject expired UserOperations", async function () {
    const testAccountAddress = await testAccount.getAddress();
    const privacyPoolAddress = await privacyPool.getAddress();
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    const commitment = ethers.randomBytes(32);
    const depositCallData = privacyPool.interface.encodeFunctionData("deposit", [commitment]);
    const executionCallData = testAccount.interface.encodeFunctionData("execute", [
      privacyPoolAddress,
      depositAmount,
      depositCallData,
    ]);

    // Create expired time parameters
    const validAfter = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
    const validUntil = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago (expired)

    const paymasterAndData = await paymaster.createPaymasterAndData(
      100000,
      50000,
      validUntil,
      validAfter
    );

    const userOp: PackedUserOperation = {
      sender: testAccountAddress,
      nonce: 0n,
      initCode: "0x",
      callData: executionCallData,
      accountGasLimits: packUints(100000n, 200000n),
      preVerificationGas: 21000n,
      gasFees: packUints(1000000000n, 2000000000n),
      paymasterAndData: paymasterAndData,
      signature: "0x"
    };

    const userOpHash = await entryPoint.getUserOpHash(userOp);
    const signature = await user.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = signature;

    // This should fail because the UserOperation is expired
    await expect(
      entryPoint.connect(bundler).handleOps([userOp], await bundler.getAddress())
    ).to.be.revertedWithCustomError(entryPoint, "FailedOpWithRevert")
     .withArgs(
        0,
        "AA33 reverted",
        paymaster.interface.encodeErrorResult("InvalidTimestamp")
    );
  });
});
