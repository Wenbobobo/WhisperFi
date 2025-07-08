// test/Paymaster.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

// Define UserOperation interface locally
interface UserOperation {
  sender: string;
  nonce: number;
  initCode: string;
  callData: string;
  callGasLimit: number;
  verificationGasLimit: number;
  preVerificationGas: number;
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
  paymasterAndData: string;
  signature: string;
  target: string;
}

// Helper function to create a mock UserOperation
const createMockUserOp = (target: string): UserOperation => {
  return {
    sender: ethers.Wallet.createRandom().address,
    nonce: 0,
    initCode: "0x",
    callData: "0x",
    callGasLimit: 0,
    verificationGasLimit: 150000,
    preVerificationGas: 21000,
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 0,
    paymasterAndData: "0x",
    signature: "0x",
    target: target, // Set the target for the operation
  };
};

describe("Paymaster", function () {
  let owner: Signer, notOwner: Signer;
  let entryPoint: any;
  let paymaster: any;
  let privacyPool: any; // We'll use this as a supported target

  beforeEach(async function () {
    [owner, notOwner] = await ethers.getSigners();

    // Deploy the EntryPoint contract
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();

    // Deploy a mock PrivacyPool to use as a target
    const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
    const verifier = await (await ethers.getContractFactory("Verifier")).deploy();
    privacyPool = await PrivacyPool.deploy(await verifier.getAddress(), ethers.encodeBytes32String("zero"), await owner.getAddress());
    await privacyPool.waitForDeployment();

    // Deploy the Paymaster
    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = await Paymaster.deploy(await entryPoint.getAddress(), await owner.getAddress());
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
      const userOp = createMockUserOp(await notOwner.getAddress()); // An unsupported address
      await expect(paymaster.validatePaymasterUserOp(userOp, ethers.randomBytes(32), 0))
        .to.be.revertedWith("Unsupported target");
    });

    it("should validate UserOp for a supported target", async function () {
      // First, support the PrivacyPool target
      await paymaster.connect(owner).setSupportedTarget(await privacyPool.getAddress(), true);

      const userOp = createMockUserOp(await privacyPool.getAddress());
      const [context, validationData] = await paymaster.validatePaymasterUserOp(userOp, ethers.randomBytes(32), 0);
      
      expect(context).to.equal("0x");
      expect(validationData).to.equal(0);
    });
  });

  describe("Funding", function () {
    it("should allow depositing funds into the EntryPoint", async function () {
      const depositAmount = ethers.parseEther("1");
      await expect(() => paymaster.connect(owner).depositToEntryPoint({ value: depositAmount }))
        .to.changeEtherBalance(entryPoint, depositAmount);
    });
  });
});
