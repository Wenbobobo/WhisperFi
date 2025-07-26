// test/Paymaster.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  deployTestEnvironment,
  TestEnvironment,
  generateUserOp,
} from "./environment";
import {
  EntryPoint,
  Paymaster,
  PrivacyPool,
} from "../typechain-types";
import { PackedUserOperation } from "./utils/UserOperation";

describe("Paymaster", function () {
  let env: TestEnvironment;
  let owner: Signer, notOwner: Signer;
  let entryPoint: EntryPoint;
  let paymaster: Paymaster;
  let privacyPool: PrivacyPool;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
    owner = env.owner;
    notOwner = env.user; // Use the 'user' signer as the non-owner
    entryPoint = env.entryPoint;
    paymaster = env.paymaster;
    privacyPool = env.privacyPool;
  });

  describe("Deployment", function () {
    it("should set the correct owner and entrypoint", async function () {
      expect(await paymaster.owner()).to.equal(await owner.getAddress());
      expect(await paymaster.entryPoint()).to.equal(await entryPoint.getAddress());
    });
  });

  describe("Sponsorship Logic", function () {
    it("should reject UserOp for an unsupported target", async function () {
        const unsupportedTarget = await notOwner.getAddress();
        const smartAccountAddress = await owner.getAddress(); // Using owner as the mock SA
  
        // Create calldata for a generic execute function
        const executeInterface = new ethers.Interface(["function execute(address,uint256,bytes)"]);
        const callData = executeInterface.encodeFunctionData("execute", [unsupportedTarget, 0, "0x"]);
  
        const userOp = await generateUserOp(env, smartAccountAddress, callData);
  
        await expect(
          paymaster.validatePaymasterUserOp(userOp, ethers.randomBytes(32), 0)
        ).to.be.revertedWithCustomError(paymaster, "UnsupportedTarget");
      });
  
      it("should validate UserOp for a supported target", async function () {
        const supportedTarget = await privacyPool.getAddress();
        const smartAccountAddress = await owner.getAddress(); // Using owner as the mock SA
  
        // Create calldata for a generic execute function
        const executeInterface = new ethers.Interface(["function execute(address,uint256,bytes)"]);
        const callData = executeInterface.encodeFunctionData("execute", [supportedTarget, 0, "0x"]);
  
        const userOp = await generateUserOp(env, smartAccountAddress, callData);
  
        const [context, validationData] = await paymaster.validatePaymasterUserOp(
          userOp,
          ethers.randomBytes(32),
          0
        );
  
        expect(context).to.equal("0x");
        expect(validationData).to.not.equal(1); // Should not be SIG_VALIDATION_FAILED
      });
  });

  describe("Funding", function () {
    it("should allow depositing funds into the EntryPoint", async function () {
      const depositAmount = ethers.parseEther("1");
      await expect(() =>
        paymaster.connect(owner).depositToEntryPoint({ value: depositAmount })
      ).to.changeEtherBalance(entryPoint, depositAmount);
    });

    it("should emit FundsDeposited event", async function () {
      const depositAmount = ethers.parseEther("1");
      await expect(
        paymaster.connect(owner).depositToEntryPoint({ value: depositAmount })
      )
        .to.emit(paymaster, "FundsDeposited")
        .withArgs(await owner.getAddress(), depositAmount);
    });
  });

  describe("Target Management", function () {
    it("should allow owner to set supported targets", async function () {
      const target = await notOwner.getAddress();
      await expect(paymaster.connect(owner).setSupportedTarget(target, true))
        .to.emit(paymaster, "TargetSupportChanged")
        .withArgs(target, true);

      expect(await paymaster.supportedTargets(target)).to.be.true;
    });

    it("should not allow non-owner to set supported targets", async function () {
      const target = await notOwner.getAddress();
      await expect(
        paymaster.connect(notOwner).setSupportedTarget(target, true)
      ).to.be.revertedWithCustomError(paymaster, "OwnableUnauthorizedAccount");
    });
  });
});
