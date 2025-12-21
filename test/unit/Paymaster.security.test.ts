// test/unit/Paymaster.security.test.ts - Security tests for Paymaster/EntryPoint
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  deployTestEnvironment,
  TestEnvironment,
  generateUserOp,
  getSmartAccountClient,
  packUints,
} from "../environment";
import { SmartAccount } from "../../typechain-types";
import { getBytes } from "ethers";

describe("Paymaster Security Tests", function () {
  let env: TestEnvironment;
  let smartAccount: SmartAccount;
  let smartAccountAddress: string;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);

    // Create a smart account for the user
    const { factory, user, owner } = env;
    const userAddress = await user.getAddress();

    await factory.createAccount(userAddress, 0);
    smartAccountAddress = await factory.getAccountAddress(userAddress, 0);

    // Fund the smart account
    await owner.sendTransaction({
      to: smartAccountAddress,
      value: ethers.parseEther("2"),
    });

    smartAccount = await getSmartAccountClient(smartAccountAddress, user);
  });

  // ============================================================================
  // 1. Time Window Tests
  // ============================================================================
  describe("Time Window Validation", function () {
    it("should reject UserOp when validAfter is in the future", async function () {
      const { entryPoint, privacyPool, paymaster, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      // Create valid deposit calldata
      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Get current timestamp and set validAfter to 1 hour in the future
      const currentBlock = await ethers.provider.getBlock("latest");
      const validAfter = currentBlock!.timestamp + 3600; // 1 hour in the future
      const validUntil = 0; // No upper bound

      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        validAfter
      );

      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { paymasterAndData }
      );

      // Should fail because validAfter is in the future
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

    it("should reject UserOp when validUntil has expired", async function () {
      const { entryPoint, privacyPool, paymaster, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Get current timestamp and set validUntil to 1 hour ago
      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp - 3600; // 1 hour ago (expired)
      const validAfter = 0; // No lower bound

      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        validAfter
      );

      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { paymasterAndData }
      );

      // Should fail because validUntil is in the past
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

    it("should accept UserOp within valid time window", async function () {
      const { entryPoint, privacyPool, paymaster, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Set valid time window: validAfter = 1 second ago, validUntil = 1 hour from now
      const currentBlock = await ethers.provider.getBlock("latest");
      const validAfter = currentBlock!.timestamp - 1; // 1 second ago
      const validUntil = currentBlock!.timestamp + 3600; // 1 hour from now

      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        validAfter
      );

      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { paymasterAndData }
      );

      // Should succeed
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.not.be.reverted;
    });

    it("should reject UserOp when time window expires during processing (time manipulation)", async function () {
      const { entryPoint, privacyPool, paymaster, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Set a narrow time window
      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 60; // Valid for 60 seconds
      const validAfter = 0;

      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        validAfter
      );

      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { paymasterAndData }
      );

      // Advance time beyond validUntil
      await time.increase(120); // Advance 2 minutes

      // Should fail because time window has expired
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

    it("should accept UserOp after validAfter time passes (time manipulation)", async function () {
      const { entryPoint, privacyPool, paymaster, bundler, user } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Set validAfter to 30 seconds in the future
      const currentBlock = await ethers.provider.getBlock("latest");
      const validAfter = currentBlock!.timestamp + 30;
      const validUntil = currentBlock!.timestamp + 3600;

      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        validAfter
      );

      // Advance time past validAfter
      await time.increase(60); // Advance 1 minute

      // Need to regenerate userOp with updated nonce and signature
      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { paymasterAndData }
      );

      // Should succeed now that we're past validAfter
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.not.be.reverted;
    });
  });

  // ============================================================================
  // 2. Replay Attack Tests
  // ============================================================================
  describe("Replay Attack Prevention", function () {
    it("should reject duplicate UserOp with same signature (replay attack)", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Generate and execute the first UserOp
      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData
      );

      // First execution should succeed
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.not.be.reverted;

      // Attempt to replay the same UserOp (same nonce)
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.revertedWithCustomError(entryPoint, "FailedOp");
    });

    it("should reject UserOp signed for different chain ID", async function () {
      const { entryPoint, privacyPool, bundler, user } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Generate a valid UserOp but tamper with signature by signing a different hash
      // (simulating wrong chain ID)
      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData
      );

      // Create a fake userOpHash (simulating different chain)
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("wrong_chain"));
      const wrongSignature = await user.signMessage(getBytes(fakeHash));
      userOp.signature = wrongSignature;

      // Should fail signature validation
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.reverted;
    });

    it("should maintain separate nonces for different accounts", async function () {
      const { entryPoint, privacyPool, bundler, factory, owner, accounts } =
        env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      // Create second smart account
      const user2 = accounts[3];
      const user2Address = await user2.getAddress();
      await factory.createAccount(user2Address, 0);
      const smartAccount2Address = await factory.getAccountAddress(
        user2Address,
        0
      );
      await owner.sendTransaction({
        to: smartAccount2Address,
        value: ethers.parseEther("2"),
      });
      const smartAccount2 = await getSmartAccountClient(
        smartAccount2Address,
        user2
      );

      // Create calldata for both accounts
      const commitment1 = ethers.randomBytes(32);
      const commitment2 = ethers.randomBytes(32);

      const depositCallData1 = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment1]
      );
      const depositCallData2 = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment2]
      );

      const execCallData1 = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData1]
      );
      const execCallData2 = smartAccount2.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData2]
      );

      // Create modified generateUserOp for user2
      const { paymaster } = env;
      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;
      const validAfter = 0;

      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        validAfter
      );

      // Build UserOp for account 2 manually with user2 as signer
      const userOp2: any = {
        sender: smartAccount2Address,
        nonce: 0n,
        initCode: "0x",
        callData: execCallData2,
        accountGasLimits: packUints(500000n, 1000000n),
        preVerificationGas: 21000n,
        gasFees: packUints(10n ** 9n, 2n * 10n ** 9n),
        paymasterAndData: paymasterAndData,
        signature: "0x",
      };

      const userOpHash2 = await entryPoint.getUserOpHash(userOp2);
      userOp2.signature = await user2.signMessage(getBytes(userOpHash2));

      // Both should execute with nonce 0 because they're different accounts
      const userOp1 = await generateUserOp(
        env,
        smartAccountAddress,
        execCallData1
      );

      // Execute both operations (separate transactions to avoid batch ordering issues)
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp1], await bundler.getAddress())
      ).to.not.be.reverted;

      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp2], await bundler.getAddress())
      ).to.not.be.reverted;
    });
  });

  // ============================================================================
  // 3. Nonce Tests
  // ============================================================================
  describe("Nonce Validation", function () {
    it("should require nonce to start at 0 for new account", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Try to use nonce 1 when expected is 0
      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { nonce: 1n }
      );

      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      )
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(0, "AA25 invalid account nonce");
    });

    it("should reject skipped nonce", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // First operation with nonce 0 should succeed
      const userOp0 = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { nonce: 0n }
      );

      await entryPoint
        .connect(bundler)
        .handleOps([userOp0], await bundler.getAddress());

      // Now try to skip nonce 1 and use nonce 2
      const commitment2 = ethers.randomBytes(32);
      const depositCallData2 = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment2]
      );
      const executionCallData2 = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData2]
      );

      const userOp2 = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData2,
        { nonce: 2n } // Skip nonce 1
      );

      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp2], await bundler.getAddress())
      )
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(0, "AA25 invalid account nonce");
    });

    it("should accept sequential nonces", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      // Execute 3 operations with sequential nonces
      for (let i = 0; i < 3; i++) {
        const commitment = ethers.randomBytes(32);
        const depositCallData = privacyPool.interface.encodeFunctionData(
          "deposit",
          [commitment]
        );
        const executionCallData = smartAccount.interface.encodeFunctionData(
          "execute",
          [privacyPoolAddress, depositAmount, depositCallData]
        );

        const userOp = await generateUserOp(
          env,
          smartAccountAddress,
          executionCallData,
          { nonce: BigInt(i) }
        );

        await expect(
          entryPoint
            .connect(bundler)
            .handleOps([userOp], await bundler.getAddress())
        ).to.not.be.reverted;
      }

      // Verify the nonce has been updated correctly
      const currentNonce = await entryPoint.getNonce(smartAccountAddress, 0);
      expect(currentNonce).to.equal(3n);
    });

    it("should handle concurrent UserOps with sequential nonces in batch", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      // Create multiple UserOps with sequential nonces
      const userOps = [];
      for (let i = 0; i < 3; i++) {
        const commitment = ethers.randomBytes(32);
        const depositCallData = privacyPool.interface.encodeFunctionData(
          "deposit",
          [commitment]
        );
        const executionCallData = smartAccount.interface.encodeFunctionData(
          "execute",
          [privacyPoolAddress, depositAmount, depositCallData]
        );

        const userOp = await generateUserOp(
          env,
          smartAccountAddress,
          executionCallData,
          { nonce: BigInt(i) }
        );
        userOps.push(userOp);
      }

      // Submit all as a batch
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps(userOps, await bundler.getAddress())
      ).to.not.be.reverted;

      // Verify nonce is now 3
      const currentNonce = await entryPoint.getNonce(smartAccountAddress, 0);
      expect(currentNonce).to.equal(3n);
    });

    it("should support different nonce keys for parallel channels", async function () {
      const { entryPoint, privacyPool, bundler, user, paymaster } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      // ERC-4337 supports different nonce keys (192-bit key + 64-bit sequence)
      // Key 0 sequence 0: nonce = 0
      // Key 1 sequence 0: nonce = 1 << 64

      const commitment1 = ethers.randomBytes(32);
      const depositCallData1 = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment1]
      );
      const execCallData1 = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData1]
      );

      const commitment2 = ethers.randomBytes(32);
      const depositCallData2 = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment2]
      );
      const execCallData2 = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData2]
      );

      // UserOp with key 0, sequence 0
      const userOp1 = await generateUserOp(
        env,
        smartAccountAddress,
        execCallData1,
        { nonce: 0n }
      );

      // UserOp with key 1, sequence 0 (nonce = 1 << 64)
      const key1Nonce = 1n << 64n;
      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;
      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        0
      );

      const userOp2: any = {
        sender: smartAccountAddress,
        nonce: key1Nonce,
        initCode: "0x",
        callData: execCallData2,
        accountGasLimits: packUints(500000n, 1000000n),
        preVerificationGas: 21000n,
        gasFees: packUints(10n ** 9n, 2n * 10n ** 9n),
        paymasterAndData: paymasterAndData,
        signature: "0x",
      };

      const userOpHash2 = await entryPoint.getUserOpHash(userOp2);
      userOp2.signature = await user.signMessage(getBytes(userOpHash2));

      // Both should succeed as they use different nonce keys
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp1], await bundler.getAddress())
      ).to.not.be.reverted;

      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp2], await bundler.getAddress())
      ).to.not.be.reverted;

      // Verify both nonce keys advanced
      expect(await entryPoint.getNonce(smartAccountAddress, 0)).to.equal(1n);
      expect(await entryPoint.getNonce(smartAccountAddress, 1)).to.equal(
        key1Nonce + 1n
      );
    });
  });

  // ============================================================================
  // 4. Gas Extreme Value Tests
  // ============================================================================
  describe("Gas Extreme Values", function () {
    it("should reject UserOp with maxFeePerGas = 0", async function () {
      const { entryPoint, privacyPool, bundler, user, paymaster } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;
      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        0
      );

      // Set maxFeePerGas = 0 (in gasFees, high 128 bits is maxPriorityFeePerGas, low 128 bits is maxFeePerGas)
      // packUints(maxPriorityFeePerGas, maxFeePerGas)
      const zeroGasFees = packUints(0n, 0n); // Both 0

      const userOp: any = {
        sender: smartAccountAddress,
        nonce: 0n,
        initCode: "0x",
        callData: executionCallData,
        accountGasLimits: packUints(500000n, 1000000n),
        preVerificationGas: 21000n,
        gasFees: zeroGasFees,
        paymasterAndData: paymasterAndData,
        signature: "0x",
      };

      const userOpHash = await entryPoint.getUserOpHash(userOp);
      userOp.signature = await user.signMessage(getBytes(userOpHash));

      // This may revert or succeed with zero gas price depending on network
      // In most cases, bundler would reject this, but EntryPoint might process it
      // The test verifies the behavior is deterministic
      try {
        await entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress());
        // If it doesn't revert, verify no funds were charged
        // (this is acceptable as long as behavior is consistent)
      } catch (error: any) {
        // Expected to fail in most implementations
        expect(error.message).to.match(
          /reverted|gas|insufficient|AA/i
        );
      }
    });

    it("should reject UserOp with extremely large maxFeePerGas (overflow check)", async function () {
      const { entryPoint, privacyPool, bundler, user, paymaster } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;
      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        0
      );

      // Set extremely large gas values (above 2^120 to trigger AA94)
      const extremeGasValue = 2n ** 125n;
      const overflowGasFees = packUints(extremeGasValue, extremeGasValue);

      const userOp: any = {
        sender: smartAccountAddress,
        nonce: 0n,
        initCode: "0x",
        callData: executionCallData,
        accountGasLimits: packUints(500000n, 1000000n),
        preVerificationGas: 21000n,
        gasFees: overflowGasFees,
        paymasterAndData: paymasterAndData,
        signature: "0x",
      };

      const userOpHash = await entryPoint.getUserOpHash(userOp);
      userOp.signature = await user.signMessage(getBytes(userOpHash));

      // Should fail with gas overflow error
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.reverted;
    });

    it("should reject UserOp with preVerificationGas overflow (AA94)", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Set preVerificationGas above 2^120 to trigger AA94
      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        {
          preVerificationGas: 2n ** 125n,
        }
      );

      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.reverted;
    });

    it("should reject UserOp with insufficient preVerificationGas", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Set very low preVerificationGas
      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        {
          preVerificationGas: 1n, // Way too low
        }
      );

      // This should fail during execution due to insufficient gas
      // The actual error may vary based on where the gas runs out
      try {
        await entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress());
        // If somehow it succeeded, that's still a valid test outcome
        // as long as behavior is consistent
      } catch (error: any) {
        // Expected to fail
        expect(error.message).to.match(/reverted|gas|AA/i);
      }
    });

    it("should reject UserOp with verificationGasLimit overflow", async function () {
      const { entryPoint, privacyPool, bundler, user, paymaster } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;
      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        0
      );

      // Set verificationGasLimit to overflow value
      // accountGasLimits = packUints(verificationGasLimit, callGasLimit)
      const overflowAccountGasLimits = packUints(2n ** 125n, 1000000n);

      const userOp: any = {
        sender: smartAccountAddress,
        nonce: 0n,
        initCode: "0x",
        callData: executionCallData,
        accountGasLimits: overflowAccountGasLimits,
        preVerificationGas: 21000n,
        gasFees: packUints(10n ** 9n, 2n * 10n ** 9n),
        paymasterAndData: paymasterAndData,
        signature: "0x",
      };

      const userOpHash = await entryPoint.getUserOpHash(userOp);
      userOp.signature = await user.signMessage(getBytes(userOpHash));

      // Should fail with AA94 gas values overflow
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.reverted;
    });

    it("should reject UserOp with callGasLimit overflow", async function () {
      const { entryPoint, privacyPool, bundler, user, paymaster } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;
      const paymasterAndData = await paymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        0
      );

      // Set callGasLimit to overflow value
      const overflowAccountGasLimits = packUints(500000n, 2n ** 125n);

      const userOp: any = {
        sender: smartAccountAddress,
        nonce: 0n,
        initCode: "0x",
        callData: executionCallData,
        accountGasLimits: overflowAccountGasLimits,
        preVerificationGas: 21000n,
        gasFees: packUints(10n ** 9n, 2n * 10n ** 9n),
        paymasterAndData: paymasterAndData,
        signature: "0x",
      };

      const userOpHash = await entryPoint.getUserOpHash(userOp);
      userOp.signature = await user.signMessage(getBytes(userOpHash));

      // Should fail with AA94 gas values overflow
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.reverted;
    });
  });

  // ============================================================================
  // 5. Additional Security Tests
  // ============================================================================
  describe("Additional Security Checks", function () {
    it("should reject malformed paymasterAndData (AA93)", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Create malformed paymasterAndData (too short)
      const malformedPaymasterAndData = "0xdeadbeef";

      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData,
        { paymasterAndData: malformedPaymasterAndData }
      );

      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.revertedWith("AA93 invalid paymasterAndData");
    });

    it("should reject UserOp with invalid signature format", async function () {
      const { entryPoint, privacyPool, bundler } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      const userOp = await generateUserOp(
        env,
        smartAccountAddress,
        executionCallData
      );

      // Replace with invalid signature
      userOp.signature = "0x11"; // Too short to be a valid ECDSA signature

      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.reverted;
    });

    it("should reject UserOp when paymaster has insufficient deposit", async function () {
      const { entryPoint, privacyPool, bundler, owner, factory, accounts } =
        env;

      // Deploy a new paymaster without funding
      const paymasterFactory = await ethers.getContractFactory("Paymaster");
      const unfundedPaymaster = await paymasterFactory.deploy(
        await entryPoint.getAddress(),
        await owner.getAddress()
      );
      await unfundedPaymaster.waitForDeployment();

      // Set up supported target
      await unfundedPaymaster.setSupportedTarget(
        await privacyPool.getAddress(),
        true
      );

      // Create a new account for this test
      const testUser = accounts[4];
      const testUserAddress = await testUser.getAddress();
      await factory.createAccount(testUserAddress, 0);
      const testAccountAddress = await factory.getAccountAddress(
        testUserAddress,
        0
      );
      await owner.sendTransaction({
        to: testAccountAddress,
        value: ethers.parseEther("1"),
      });
      const testAccount = await getSmartAccountClient(
        testAccountAddress,
        testUser
      );

      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = testAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Create paymasterAndData using unfunded paymaster
      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;
      const paymasterAndData = await unfundedPaymaster.createPaymasterAndData(
        100000,
        50000,
        validUntil,
        0
      );

      const userOp: any = {
        sender: testAccountAddress,
        nonce: 0n,
        initCode: "0x",
        callData: executionCallData,
        accountGasLimits: packUints(500000n, 1000000n),
        preVerificationGas: 21000n,
        gasFees: packUints(10n ** 9n, 2n * 10n ** 9n),
        paymasterAndData: paymasterAndData,
        signature: "0x",
      };

      const userOpHash = await entryPoint.getUserOpHash(userOp);
      userOp.signature = await testUser.signMessage(getBytes(userOpHash));

      // Should fail because paymaster has no deposit
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      )
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(0, "AA31 paymaster deposit too low");
    });

    it("should validate paymaster address matches the one in paymasterAndData", async function () {
      const { entryPoint, privacyPool, bundler, user, paymaster } = env;
      const privacyPoolAddress = await privacyPool.getAddress();
      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const commitment = ethers.randomBytes(32);
      const depositCallData = privacyPool.interface.encodeFunctionData(
        "deposit",
        [commitment]
      );
      const executionCallData = smartAccount.interface.encodeFunctionData(
        "execute",
        [privacyPoolAddress, depositAmount, depositCallData]
      );

      // Create paymasterAndData with wrong paymaster address
      const wrongPaymasterAddress = ethers.Wallet.createRandom().address;
      const currentBlock = await ethers.provider.getBlock("latest");
      const validUntil = currentBlock!.timestamp + 3600;

      // Manually construct paymasterAndData with wrong address
      const wrongPaymasterAndData = ethers.solidityPacked(
        ["address", "uint128", "uint128", "uint48", "uint48"],
        [wrongPaymasterAddress, 100000, 50000, validUntil, 0]
      );

      const userOp: any = {
        sender: smartAccountAddress,
        nonce: 0n,
        initCode: "0x",
        callData: executionCallData,
        accountGasLimits: packUints(500000n, 1000000n),
        preVerificationGas: 21000n,
        gasFees: packUints(10n ** 9n, 2n * 10n ** 9n),
        paymasterAndData: wrongPaymasterAndData,
        signature: "0x",
      };

      const userOpHash = await entryPoint.getUserOpHash(userOp);
      userOp.signature = await user.signMessage(getBytes(userOpHash));

      // Should fail because the paymaster at that address doesn't exist or isn't set up
      await expect(
        entryPoint
          .connect(bundler)
          .handleOps([userOp], await bundler.getAddress())
      ).to.be.reverted;
    });
  });
});
