import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract, keccak256, AbiCoder, getCreate2Address, solidityPacked } from "ethers";

describe("Debug CREATE2 Address Calculation", function () {
  let owner: Signer, user: Signer;
  let entryPoint: Contract;
  let debugFactory: Contract;
  let userAddress: string;
  let entryPointAddress: string;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    userAddress = await user.getAddress();

    // Deploy the EntryPoint contract
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    entryPointAddress = await entryPoint.getAddress();

    // Deploy the DebugFactory
    const DebugFactory = await ethers.getContractFactory("DebugFactory");
    debugFactory = await DebugFactory.deploy(entryPointAddress);
    await debugFactory.waitForDeployment();
  });

  it("should pinpoint the discrepancy in CREATE2 calculation", async function () {
    const salt = 1;
    const saltHex = ethers.toBeHex(salt, 32);

    // --- Part 1: Get values from Solidity via DebugFactory ---
    const creationCodeSol = await debugFactory.getCreationCode();
    const constructorArgsSol = await debugFactory.getConstructorArgs(userAddress);
    const initCodeHashSol = await debugFactory.getCreationCodeHash(userAddress);
    const { predictedAddress: predictedAddressSol } = await debugFactory.debugCreate2(userAddress, salt);
    const actualDeployedAddress = await debugFactory.actualDeploy.staticCall(userAddress, salt);

    // --- Part 2: Calculate the same values in JavaScript using ethers.js ---
    const TestAccount = await ethers.getContractFactory("TestAccount");
    const creationCodeJs = TestAccount.bytecode;
    const constructorArgsJs = AbiCoder.defaultAbiCoder().encode(
        ['address', 'address'],
        [entryPointAddress, userAddress]
    );
    const initCodeJs = solidityPacked(
        ['bytes', 'bytes'],
        [creationCodeJs, constructorArgsJs]
    );
    const initCodeHashJs = keccak256(initCodeJs);
    const factoryAddress = await debugFactory.getAddress();
    const predictedAddressJs = getCreate2Address(factoryAddress, saltHex, initCodeHashJs);

    // --- Part 3: Log and Compare ---
    console.log("==================== CREATE2 DEBUG ====================");
    console.log(`Factory Address:       ${factoryAddress}`);
    console.log(`EntryPoint Address:    ${entryPointAddress}`);
    console.log(`User (Owner) Address:  ${userAddress}`);
    console.log(`Salt:                  ${salt}`);
    console.log("-------------------------------------------------------");
    console.log("Init Code Hash (keccak256(creationCode + constructorArgs)):");
    console.log(`  - Solidity: ${initCodeHashSol}`);
    console.log(`  - JS:       ${initCodeHashJs}`);
    console.log("-------------------------------------------------------");
    console.log("Final Predicted Address:");
    console.log(`  - Solidity (debugCreate2):   ${predictedAddressSol}`);
    console.log(`  - JS (getCreate2Address):    ${predictedAddressJs}`);
    console.log(`  - Solidity (actual deploy):  ${actualDeployedAddress}`);
    console.log("=======================================================");

    // The final, most important assertion
    expect(actualDeployedAddress).to.equal(predictedAddressSol, "Actual deployed address differs from Solidity prediction");
  });
});
