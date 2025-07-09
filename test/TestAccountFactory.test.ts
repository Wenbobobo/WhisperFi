// test/TestAccountFactory.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";

describe("TestAccountFactory", function () {
  let owner: Signer, user: Signer;
  let entryPoint: Contract;
  let factory: Contract;
  let userAddress: string;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    userAddress = await user.getAddress();

    // Deploy the EntryPoint contract
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    const entryPointAddress = await entryPoint.getAddress();
    
    // Deploy the TestAccountFactory
    const TestAccountFactory = await ethers.getContractFactory("TestAccountFactory");
    factory = await TestAccountFactory.deploy(entryPointAddress);
    await factory.waitForDeployment();
  });

  it("should deploy the factory with the correct entrypoint", async function () {
    expect(await factory.entryPoint()).to.equal(await entryPoint.getAddress());
  });

  // This test is the core of the problem. It directly compares the view function and the static call.
  it("should correctly predict the account address", async function () {
    const salt = 1;
    const predictedAddress = await factory.getAddress(userAddress, salt);

    // The static call will return the address created by the `new` keyword.
    // The `require` statement inside the contract ensures they match.
    // If this test passes, it means the prediction is correct.
    const actualAddress = await factory.createAccount.staticCall(
      userAddress,
      salt
    );

    expect(actualAddress).to.equal(predictedAddress);
  });

  // This test verifies the properties of the *actually created* account.
  // It does not rely on getAddress or staticCall for its assertions.
  it("should create an account with the correct owner and entrypoint", async function () {
    const salt = 2;
    const tx = await factory.createAccount(userAddress, salt);
    const receipt = await tx.wait();

    // To get the created address robustly, we parse the event from the receipt.
    const event = receipt.logs.find(log => {
        try {
            const parsedLog = factory.interface.parseLog(log);
            return parsedLog?.name === "AccountCreated";
        } catch (e) { return false; }
    });
    expect(event, "AccountCreated event not found").to.not.be.undefined;
    const actualAddress = event.args.account;

    const accountContract = await ethers.getContractAt("TestAccount", actualAddress);
    expect(await accountContract.owner()).to.equal(userAddress);
    expect(await accountContract.entryPoint()).to.equal(await entryPoint.getAddress());
  });

  // This test verifies the event emission using hardhat-chai-matchers for clarity.
  it("should emit an AccountCreated event with the correct arguments", async function () {
    const salt = 3;
    // We must first determine the correct address that *will* be created.
    // The most reliable way is to use staticCall.
    const expectedAddress = await factory.createAccount.staticCall(userAddress, salt);

    await expect(factory.createAccount(userAddress, salt))
      .to.emit(factory, "AccountCreated")
      .withArgs(expectedAddress, userAddress, salt);
  });

  it("should fail to create an account with the same salt", async function () {
    const salt = 4;
    await factory.createAccount(userAddress, salt);

    // Attempting to create again with the same salt should fail due to CREATE2 collision.
    await expect(factory.createAccount(userAddress, salt)).to.be.reverted;
  });
});
