// test/Paymaster.test.ts
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

// Helper function to create a mock PackedUserOperation
const createMockUserOp = (sender: string, target?: string): PackedUserOperation => {
  // Create a mock function selector (4 bytes) + target address (20 bytes)
  const functionSelector = "0x12345678"; // Mock function selector (4 bytes)
  const targetAddress = target || ethers.ZeroAddress;
  
  // Ensure target address is properly formatted (20 bytes)
  const paddedTarget = targetAddress.slice(2).padStart(40, '0');
  
  // Create callData with function selector + target address + additional padding
  const mockCallData = functionSelector + paddedTarget + "0".repeat(24); // Total: 4 + 20 + 12 = 36 bytes minimum
  
  return {
    sender: sender,
    nonce: 0n,
    initCode: "0x",
    callData: mockCallData,
    accountGasLimits: packUints(100000n, 200000n), // verificationGasLimit, callGasLimit
    preVerificationGas: 21000n,
    gasFees: packUints(1000000000n, 2000000000n), // maxPriorityFeePerGas, maxFeePerGas
    paymasterAndData: "0x",
    signature: "0x"
  };
};

describe("Paymaster", function () {
  let owner: Signer, notOwner: Signer;
  let entryPoint: any;
  let paymaster: any;
  let privacyPool: any;

  beforeEach(async function () {
    [owner, notOwner] = await ethers.getSigners();

    // Deploy the EntryPoint contract
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();

    // Deploy a mock PrivacyPool to use as a target
    const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
    const verifier = await (await ethers.getContractFactory("Verifier")).deploy();
    privacyPool = await PrivacyPool.deploy(
      await verifier.getAddress(), 
      ethers.encodeBytes32String("zero"), 
      await owner.getAddress()
    );
    await privacyPool.waitForDeployment();

    // Deploy the Paymaster
    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = await Paymaster.deploy(
      await entryPoint.getAddress(), 
      await owner.getAddress()
    );
    await paymaster.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct owner and entrypoint", async function () {
      expect(await paymaster.owner()).to.equal(await owner.getAddress());
      expect(await paymaster.entryPoint()).to.equal(await entryPoint.getAddress());
    });
  });

  describe("Sponsorship Logic", function () {
    it("should reject UserOp for an unsupported target", async function () {
      // Use a random address as an unsupported target
      const unsupportedTarget = await notOwner.getAddress();
      const userOp = createMockUserOp(await owner.getAddress(), unsupportedTarget);
      
      await expect(
        paymaster.validatePaymasterUserOp(userOp, ethers.randomBytes(32), 0)
      ).to.be.revertedWithCustomError(paymaster, "UnsupportedTarget");
    });

    it("should validate UserOp for a supported target", async function () {
      // Use privacyPool as the supported target
      const supportedTarget = await privacyPool.getAddress();
      await paymaster.connect(owner).setSupportedTarget(supportedTarget, true);

      const userOp = createMockUserOp(await owner.getAddress(), supportedTarget);
      const [context, validationData] = await paymaster.validatePaymasterUserOp(
        userOp, 
        ethers.randomBytes(32), 
        0
      );
      
      expect(context).to.equal("0x");
      expect(validationData).to.equal(0);
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
      ).to.emit(paymaster, "FundsDeposited")
        .withArgs(await owner.getAddress(), depositAmount);
    });
  });

  describe("Target Management", function () {
    it("should allow owner to set supported targets", async function () {
      const target = await notOwner.getAddress();
      await expect(
        paymaster.connect(owner).setSupportedTarget(target, true)
      ).to.emit(paymaster, "TargetSupportChanged")
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
