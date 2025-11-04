import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployTestEnvironment, TestEnvironment } from "../environment";

const ZERO_PROOF_A: [string, string] = ["0", "0"];
const ZERO_PROOF_B: [[string, string], [string, string]] = [
  ["0", "0"],
  ["0", "0"],
];
const ZERO_PROOF_C: [string, string] = ["0", "0"];

describe("Integration — Withdraw relayer payouts", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  it("routes withdrawal payouts between recipient and relayer when fee > 0", async function () {
    const { privacyPool, owner, accounts } = env;

    const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

    const secretBytes = ethers.randomBytes(32);
    const secret = ethers.toBigInt(ethers.hexlify(secretBytes));
    const commitment = await privacyPool.calculateCommitment(secret, depositAmount);

    await privacyPool
      .connect(owner)
      .deposit(commitment, { value: depositAmount });

    const root = await privacyPool.merkleRoot();

    const recipient = await accounts[3].getAddress();
    const relayer = await accounts[4].getAddress();

    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
    const relayerBalanceBefore = await ethers.provider.getBalance(relayer);

    const fee = depositAmount / 5n;
    const nullifier = ethers.hexlify(ethers.randomBytes(32));

    await expect(
      privacyPool
        .connect(owner)
        .withdraw(
          ZERO_PROOF_A,
          ZERO_PROOF_B,
          ZERO_PROOF_C,
          root,
          nullifier,
          recipient,
          fee,
          relayer
        )
    )
      .to.emit(privacyPool, "Withdrawal")
      .withArgs(recipient, nullifier);

    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
    const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

    expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
      depositAmount - fee
    );
    expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(fee);

    expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
  });
});
