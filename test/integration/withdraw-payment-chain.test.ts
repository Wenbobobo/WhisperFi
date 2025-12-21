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

describe("Integration — Payment Chain Regression Tests", function () {
  let env: TestEnvironment;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
  });

  describe("Valid fee splits", function () {
    it("should handle fee = 0 (all to recipient, none to relayer)", async function () {
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

      const fee = 0n;
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

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(depositAmount);
      expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(0n);

      expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
    });

    it("should split funds correctly with 0.001 ETH fee", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
      const feeAmount = ethers.parseEther("0.001");

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
            feeAmount,
            relayer
          )
      )
        .to.emit(privacyPool, "Withdrawal")
        .withArgs(recipient, nullifier);

      const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
      const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
        depositAmount - feeAmount
      );
      expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(feeAmount);

      expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
    });

    it("should split funds correctly with 0.01 ETH fee", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
      const feeAmount = ethers.parseEther("0.01");

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
            feeAmount,
            relayer
          )
      )
        .to.emit(privacyPool, "Withdrawal")
        .withArgs(recipient, nullifier);

      const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
      const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
        depositAmount - feeAmount
      );
      expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(feeAmount);

      expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
    });

    it("should split funds correctly with 0.05 ETH fee", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
      const feeAmount = ethers.parseEther("0.05");

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
            feeAmount,
            relayer
          )
      )
        .to.emit(privacyPool, "Withdrawal")
        .withArgs(recipient, nullifier);

      const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
      const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
        depositAmount - feeAmount
      );
      expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(feeAmount);

      expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
    });

    it("should split funds correctly with 0.099 ETH fee (near maximum)", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
      const feeAmount = ethers.parseEther("0.099");

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
            feeAmount,
            relayer
          )
      )
        .to.emit(privacyPool, "Withdrawal")
        .withArgs(recipient, nullifier);

      const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
      const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
        depositAmount - feeAmount
      );
      expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(feeAmount);

      expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
    });
  });

  describe("Edge cases", function () {
    it("should handle fee equal to deposit amount (all to relayer)", async function () {
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

      const fee = depositAmount;
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

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(0n);
      expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(depositAmount);

      expect(await privacyPool.nullifiers(nullifier)).to.equal(true);
    });

    it("should revert when fee exceeds deposit amount", async function () {
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

      const fee = depositAmount + 1n;
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
      ).to.be.revertedWith("Fee exceeds deposit");
    });

    it("should revert when fee significantly exceeds deposit amount", async function () {
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

      const fee = ethers.parseEther("1.0");
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
      ).to.be.revertedWith("Fee exceeds deposit");
    });
  });

  describe("Multiple withdrawals in sequence", function () {
    it("should handle multiple withdrawals with varying fees correctly", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      // First withdrawal: 0 fee
      {
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

        const fee = 0n;
        const nullifier = ethers.hexlify(ethers.randomBytes(32));

        await privacyPool
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
          );

        const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
        const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

        expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(depositAmount);
        expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(0n);
      }

      // Second withdrawal: 0.01 ETH fee
      {
        const secretBytes = ethers.randomBytes(32);
        const secret = ethers.toBigInt(ethers.hexlify(secretBytes));
        const commitment = await privacyPool.calculateCommitment(secret, depositAmount);

        await privacyPool
          .connect(owner)
          .deposit(commitment, { value: depositAmount });

        const root = await privacyPool.merkleRoot();
        const recipient = await accounts[5].getAddress();
        const relayer = await accounts[6].getAddress();

        const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
        const relayerBalanceBefore = await ethers.provider.getBalance(relayer);

        const fee = ethers.parseEther("0.01");
        const nullifier = ethers.hexlify(ethers.randomBytes(32));

        await privacyPool
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
          );

        const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
        const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

        expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
          depositAmount - fee
        );
        expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(fee);
      }

      // Third withdrawal: 0.05 ETH fee
      {
        const secretBytes = ethers.randomBytes(32);
        const secret = ethers.toBigInt(ethers.hexlify(secretBytes));
        const commitment = await privacyPool.calculateCommitment(secret, depositAmount);

        await privacyPool
          .connect(owner)
          .deposit(commitment, { value: depositAmount });

        const root = await privacyPool.merkleRoot();
        const recipient = await accounts[7].getAddress();
        const relayer = await accounts[8].getAddress();

        const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
        const relayerBalanceBefore = await ethers.provider.getBalance(relayer);

        const fee = ethers.parseEther("0.05");
        const nullifier = ethers.hexlify(ethers.randomBytes(32));

        await privacyPool
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
          );

        const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
        const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

        expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
          depositAmount - fee
        );
        expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(fee);
      }

      // Fourth withdrawal: maximum fee (equals deposit)
      {
        const secretBytes = ethers.randomBytes(32);
        const secret = ethers.toBigInt(ethers.hexlify(secretBytes));
        const commitment = await privacyPool.calculateCommitment(secret, depositAmount);

        await privacyPool
          .connect(owner)
          .deposit(commitment, { value: depositAmount });

        const root = await privacyPool.merkleRoot();
        const recipient = await accounts[9].getAddress();
        const relayer = await accounts[10].getAddress();

        const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
        const relayerBalanceBefore = await ethers.provider.getBalance(relayer);

        const fee = depositAmount;
        const nullifier = ethers.hexlify(ethers.randomBytes(32));

        await privacyPool
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
          );

        const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
        const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

        expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(0n);
        expect(relayerBalanceAfter - relayerBalanceBefore).to.equal(depositAmount);
      }
    });

    it("should accumulate relayer fees across multiple withdrawals", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
      const relayer = await accounts[4].getAddress();

      const relayerBalanceInitial = await ethers.provider.getBalance(relayer);
      let expectedAccumulatedFees = 0n;

      const fees = [
        ethers.parseEther("0.001"),
        ethers.parseEther("0.005"),
        ethers.parseEther("0.01"),
      ];

      for (const fee of fees) {
        const secretBytes = ethers.randomBytes(32);
        const secret = ethers.toBigInt(ethers.hexlify(secretBytes));
        const commitment = await privacyPool.calculateCommitment(secret, depositAmount);

        await privacyPool
          .connect(owner)
          .deposit(commitment, { value: depositAmount });

        const root = await privacyPool.merkleRoot();
        const recipient = await accounts[3].getAddress();
        const nullifier = ethers.hexlify(ethers.randomBytes(32));

        await privacyPool
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
          );

        expectedAccumulatedFees += fee;
      }

      const relayerBalanceFinal = await ethers.provider.getBalance(relayer);

      expect(relayerBalanceFinal - relayerBalanceInitial).to.equal(
        expectedAccumulatedFees
      );
    });

    it("should handle same relayer and recipient across multiple withdrawals", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
      const recipient = await accounts[3].getAddress();
      const relayer = await accounts[4].getAddress();

      const recipientBalanceInitial = await ethers.provider.getBalance(recipient);
      const relayerBalanceInitial = await ethers.provider.getBalance(relayer);

      let expectedRecipientTotal = 0n;
      let expectedRelayerTotal = 0n;

      const testCases = [
        { fee: 0n },
        { fee: ethers.parseEther("0.02") },
        { fee: ethers.parseEther("0.05") },
      ];

      for (const testCase of testCases) {
        const secretBytes = ethers.randomBytes(32);
        const secret = ethers.toBigInt(ethers.hexlify(secretBytes));
        const commitment = await privacyPool.calculateCommitment(secret, depositAmount);

        await privacyPool
          .connect(owner)
          .deposit(commitment, { value: depositAmount });

        const root = await privacyPool.merkleRoot();
        const nullifier = ethers.hexlify(ethers.randomBytes(32));

        await privacyPool
          .connect(owner)
          .withdraw(
            ZERO_PROOF_A,
            ZERO_PROOF_B,
            ZERO_PROOF_C,
            root,
            nullifier,
            recipient,
            testCase.fee,
            relayer
          );

        expectedRecipientTotal += depositAmount - testCase.fee;
        expectedRelayerTotal += testCase.fee;
      }

      const recipientBalanceFinal = await ethers.provider.getBalance(recipient);
      const relayerBalanceFinal = await ethers.provider.getBalance(relayer);

      expect(recipientBalanceFinal - recipientBalanceInitial).to.equal(
        expectedRecipientTotal
      );
      expect(relayerBalanceFinal - relayerBalanceInitial).to.equal(expectedRelayerTotal);
    });
  });

  describe("Balance verification", function () {
    it("should ensure total balances add up correctly after withdrawal", async function () {
      const { privacyPool, owner, accounts } = env;

      const depositAmount = await privacyPool.DEPOSIT_AMOUNT();

      const secretBytes = ethers.randomBytes(32);
      const secret = ethers.toBigInt(ethers.hexlify(secretBytes));
      const commitment = await privacyPool.calculateCommitment(secret, depositAmount);

      await privacyPool
        .connect(owner)
        .deposit(commitment, { value: depositAmount });

      const poolBalanceBefore = await ethers.provider.getBalance(
        await privacyPool.getAddress()
      );

      const root = await privacyPool.merkleRoot();

      const recipient = await accounts[3].getAddress();
      const relayer = await accounts[4].getAddress();

      const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
      const relayerBalanceBefore = await ethers.provider.getBalance(relayer);

      const fee = ethers.parseEther("0.03");
      const nullifier = ethers.hexlify(ethers.randomBytes(32));

      await privacyPool
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
        );

      const poolBalanceAfter = await ethers.provider.getBalance(
        await privacyPool.getAddress()
      );
      const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
      const relayerBalanceAfter = await ethers.provider.getBalance(relayer);

      const recipientGain = recipientBalanceAfter - recipientBalanceBefore;
      const relayerGain = relayerBalanceAfter - relayerBalanceBefore;
      const poolLoss = poolBalanceBefore - poolBalanceAfter;

      expect(recipientGain).to.equal(depositAmount - fee);
      expect(relayerGain).to.equal(fee);
      expect(poolLoss).to.equal(depositAmount);
      expect(recipientGain + relayerGain).to.equal(poolLoss);
    });
  });
});
