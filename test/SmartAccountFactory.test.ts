// test/SmartAccountFactory.test.ts - Unit tests for the SmartAccountFactory contract.
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTestEnvironment, TestEnvironment } from "./environment";
import { EntryPoint, SmartAccountFactory } from "../typechain-types";

describe("SmartAccountFactory", function () {
  let env: TestEnvironment;
  let owner: Signer, user: Signer;
  let entryPoint: EntryPoint;
  let factory: SmartAccountFactory;
  let userAddress: string;

  beforeEach(async function () {
    env = await loadFixture(deployTestEnvironment);
    owner = env.owner;
    user = env.user;
    entryPoint = env.entryPoint;
    factory = env.factory;
    userAddress = await user.getAddress();
  });

  it("should deploy the factory with the correct entrypoint", async function () {
    expect(await factory.entryPoint()).to.equal(await entryPoint.getAddress());
  });

  it("should correctly predict the account address", async function () {
    const salt = 1;
    const predictedAddress = await factory.getAccountAddress(userAddress, salt);
    const actualAddress = await factory.createAccount.staticCall(
      userAddress,
      salt
    );

    expect(actualAddress).to.equal(predictedAddress);
  });

  it("should create an account with the correct owner and entrypoint", async function () {
    const salt = 2;
    const tx = await factory.createAccount(userAddress, salt);
    const receipt = await tx.wait();

    const eventLog = receipt?.logs.find((log) => {
      try {
        const parsedLog = factory.interface.parseLog(log as any);
        return parsedLog?.name === "AccountCreated";
      } catch (e) {
        return false;
      }
    });

    expect(eventLog, "AccountCreated event not found").to.not.be.undefined;
    const parsedEvent = factory.interface.parseLog(eventLog as any);
    const actualAddress = parsedEvent!.args.account;

    const accountContract = await ethers.getContractAt(
      "SmartAccount",
      actualAddress
    );
    expect(await accountContract.owner()).to.equal(userAddress);
    expect(await accountContract.entryPoint()).to.equal(
      await entryPoint.getAddress()
    );
  });

  it("should emit an AccountCreated event with the correct arguments", async function () {
    const salt = 3;
    const expectedAddress = await factory.createAccount.staticCall(
      userAddress,
      salt
    );

    await expect(factory.createAccount(userAddress, salt))
      .to.emit(factory, "AccountCreated")
      .withArgs(expectedAddress, userAddress, salt);
  });

  it("should fail to create an account with the same salt", async function () {
    const salt = 4;
    await factory.createAccount(userAddress, salt);

    await expect(factory.createAccount(userAddress, salt)).to.be.reverted;
  });
});
