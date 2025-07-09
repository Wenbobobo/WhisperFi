import { expect } from "chai";
import { ethers } from "hardhat";

describe("Simple Factory Comparison", function () {
  let entryPoint, factory1, factory2, user;
  let userAddress, entryPointAddress;

  beforeEach(async function () {
    [, user] = await ethers.getSigners();
    userAddress = await user.getAddress();

    // Deploy EntryPoint
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    entryPointAddress = await entryPoint.getAddress();

    // Deploy both factories
    const TestAccountFactory = await ethers.getContractFactory("TestAccountFactory");
    factory1 = await TestAccountFactory.deploy(entryPointAddress);
    await factory1.waitForDeployment();

    const TestAccountFactoryDebug = await ethers.getContractFactory("TestAccountFactoryDebug");
    factory2 = await TestAccountFactoryDebug.deploy(entryPointAddress);
    await factory2.waitForDeployment();
  });

  it("should have consistent getAccountAddress results within each factory", async function () {
    const salt = 1;
    
    console.log("Factory 1 address:", await factory1.getAddress());
    console.log("Factory 2 address:", await factory2.getAddress());
    
    // Test Factory 1 consistency
    const addr1 = await factory1.getAccountAddress(userAddress, salt);
    const actual1 = await factory1.createAccount.staticCall(userAddress, salt);
    
    // Test Factory 2 consistency
    const addr2 = await factory2.getAccountAddress(userAddress, salt);
    const debugInfo = await factory2.getAddressDebug(userAddress, salt);
    
    console.log("Factory 1 getAccountAddress:", addr1);
    console.log("Factory 1 actual deploy:", actual1);
    console.log("Factory 2 getAccountAddress:", addr2);
    console.log("Factory 2 debug predicted:", debugInfo.predictedAddress);
    
    // Each factory should be internally consistent
    expect(actual1).to.equal(addr1, "Factory 1 prediction mismatch");
    expect(addr2).to.equal(debugInfo.predictedAddress, "Factory 2 prediction mismatch");
  });
});
