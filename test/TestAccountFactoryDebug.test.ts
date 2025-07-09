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

  it("should correctly predict the account address", async function () {
    const salt = 1;
    
    // Get debug info
    const debugInfo = await factory.getAddressDebug(userAddress, salt);
    console.log("Debug Info:");
    console.log("  initCodeHash:", debugInfo.initCodeHash);
    console.log("  salt:", debugInfo.salt);
    console.log("  factory:", debugInfo.factory);
    console.log("  finalHash:", debugInfo.finalHash);
    console.log("  predictedAddress:", debugInfo.predictedAddress);
    
    const predictedAddress = await factory.getAddress(userAddress, salt);
    console.log("getAddress result:", predictedAddress);
    
    // Test deployment debug
    const createDebug = await factory.createAccountDebug.staticCall(userAddress, salt);
    console.log("createAccountDebug:");
    console.log("  predictedAddress:", createDebug.predictedAddress);
    console.log("  actualAddress:", createDebug.actualAddress);
    console.log("  matches:", createDebug.matches);
    
    expect(createDebug.matches).to.be.true;
    expect(createDebug.actualAddress).to.equal(predictedAddress);
  });

  it("should create an account with the correct owner and entrypoint", async function () {
    const salt = 2;
    const tx = await factory.createAccount(userAddress, salt);
    const receipt = await tx.wait();

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

  it("should emit an AccountCreated event with the correct arguments", async function () {
    const salt = 3;
    const expectedAddress = await factory.getAddress(userAddress, salt);

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

describe("TestAccountFactoryDebug", function () {
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
    
    // Deploy the TestAccountFactoryDebug
    const TestAccountFactoryDebug = await ethers.getContractFactory("TestAccountFactoryDebug");
    factory = await TestAccountFactoryDebug.deploy(entryPointAddress);
    await factory.waitForDeployment();
  });

  it("should deploy the factory with the correct entrypoint", async function () {
    expect(await factory.entryPoint()).to.equal(await entryPoint.getAddress());
  });

  it("should correctly predict the account address", async function () {
    const salt = 1;
    
    // Get debug info
    const debugInfo = await factory.getAddressDebug(userAddress, salt);
    console.log("Debug Info:");
    console.log("  initCodeHash:", debugInfo.initCodeHash);
    console.log("  salt:", debugInfo.salt);
    console.log("  factory:", debugInfo.factory);
    console.log("  finalHash:", debugInfo.finalHash);
    console.log("  predictedAddress:", debugInfo.predictedAddress);
    
    const predictedAddress = await factory.getAddress(userAddress, salt);
    console.log("getAddress result:", predictedAddress);
    
    // Test deployment debug
    const createDebug = await factory.createAccountDebug.staticCall(userAddress, salt);
    console.log("createAccountDebug:");
    console.log("  predictedAddress:", createDebug.predictedAddress);
    console.log("  actualAddress:", createDebug.actualAddress);
    console.log("  matches:", createDebug.matches);
    
    expect(createDebug.matches).to.be.true;
    expect(createDebug.actualAddress).to.equal(predictedAddress);
  });

  it("should create an account with the correct owner and entrypoint", async function () {
    const salt = 2;
    const tx = await factory.createAccount(userAddress, salt);
    const receipt = await tx.wait();

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

  it("should emit an AccountCreated event with the correct arguments", async function () {
    const salt = 3;
    const expectedAddress = await factory.getAddress(userAddress, salt);

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