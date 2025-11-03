import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "../environment";

const generateMockProof = (): [
  [string, string],
  [[string, string], [string, string]],
  [string, string]
] => {
  const pA: [string, string] = ["0", "0"];
  const pB: [[string, string], [string, string]] = [
    ["0", "0"],
    ["0", "0"],
  ];
  const pC: [string, string] = ["0", "0"];
  return [pA, pB, pC];
};

describe("PrivacyPool withdrawal payouts", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  async function prepareDeposit() {
    const { privacyPool, owner } = env;
    const commitment = ethers.randomBytes(32);
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    await privacyPool.connect(owner).deposit(commitment, { value: depositAmount });
    const root = await privacyPool.merkleRoot();
    return { commitment, root };
  }

  it("transfers payout to payable contract recipients and relayers via call", async function () {
    const { privacyPool, owner } = env;
    await prepareDeposit();
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    const recipientFactory = await ethers.getContractFactory("TestRecipient");
    const recipient = await recipientFactory.deploy();
    await recipient.waitForDeployment();
    const recipientAddress = await recipient.getAddress();

    const relayer = env.accounts[4];
    const relayerAddress = await relayer.getAddress();
    const relayerBalanceBefore = await ethers.provider.getBalance(relayerAddress);

    const [pA, pB, pC] = generateMockProof();
    const nullifier = ethers.randomBytes(32);
    const currentRoot = await privacyPool.merkleRoot();
    const fee = depositAmount / 10n;

    await expect(
      privacyPool.connect(owner).withdraw(
        pA,
        pB,
        pC,
        currentRoot,
        nullifier,
        recipientAddress,
        fee,
        relayerAddress
      )
    ).to.emit(privacyPool, "Withdrawal");

    const expectedRecipientAmount = depositAmount - fee;
    expect(await recipient.totalReceived()).to.equal(expectedRecipientAmount);

    const relayerBalanceAfter = await ethers.provider.getBalance(relayerAddress);
    expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(fee);
  });

  it("reverts when recipient transfer fails", async function () {
    const { privacyPool, owner } = env;
    await prepareDeposit();

    const rejectingFactory = await ethers.getContractFactory("RevertingRecipient");
    const rejectingRecipient = await rejectingFactory.deploy();
    await rejectingRecipient.waitForDeployment();
    const rejectingRecipientAddress = await rejectingRecipient.getAddress();

    const [pA, pB, pC] = generateMockProof();
    const nullifier = ethers.randomBytes(32);
    const currentRoot = await privacyPool.merkleRoot();

    await expect(
      privacyPool.connect(owner).withdraw(
        pA,
        pB,
        pC,
        currentRoot,
        nullifier,
        rejectingRecipientAddress,
        0,
        await owner.getAddress()
      )
    ).to.be.revertedWith("Recipient transfer failed");
  });

  it("reverts when relayer transfer fails", async function () {
    const { privacyPool, owner } = env;
    await prepareDeposit();

    const recipient = await owner.getAddress();

    const rejectingFactory = await ethers.getContractFactory("RevertingRecipient");
    const rejectingRelayer = await rejectingFactory.deploy();
    await rejectingRelayer.waitForDeployment();
    const rejectingRelayerAddress = await rejectingRelayer.getAddress();

    const [pA, pB, pC] = generateMockProof();
    const nullifier = ethers.randomBytes(32);
    const currentRoot = await privacyPool.merkleRoot();

    await expect(
      privacyPool.connect(owner).withdraw(
        pA,
        pB,
        pC,
        currentRoot,
        nullifier,
        recipient,
        1n,
        rejectingRelayerAddress
      )
    ).to.be.revertedWith("Relayer transfer failed");
  });
});
