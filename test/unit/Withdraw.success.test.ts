import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "../environment";

describe("PrivacyPool Withdraw (success path)", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("should withdraw successfully when verifier approves (mock)", async function () {
    const { privacyPool, owner } = env;

    // Deposit once to create a valid root and fund the pool
    const commitment = ethers.randomBytes(32);
    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
    await privacyPool.connect(owner).deposit(commitment, { value: depositAmount });

    const currentRoot = await privacyPool.merkleRoot();

    // Prepare dummy proof and values (MockVerifier returns true by default in this repo)
    const pA: [string, string] = ["0", "0"];
    const pB: [[string, string], [string, string]] = [
      ["0", "0"],
      ["0", "0"],
    ];
    const pC: [string, string] = ["0", "0"];
    const nullifier = ethers.randomBytes(32);
    const recipient = await env.accounts[3].getAddress();

    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);

    const tx = await privacyPool.withdraw(
      pA,
      pB,
      pC,
      currentRoot,
      nullifier,
      recipient,
      0, // fee
      recipient // relayer (not used when fee=0)
    );
    await expect(tx).to.emit(privacyPool, "Withdrawal");

    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
    expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(depositAmount);

    // Nullifier should be marked as used
    expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
  });
});
