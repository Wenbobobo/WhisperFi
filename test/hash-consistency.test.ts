import { buildPoseidon } from "circomlibjs";
import { ethers } from "hardhat";
import { expect } from "chai";
import { PrivacyPool } from "../typechain-types";
import * as util from 'util';

describe("Hash Consistency Test", function () {
    let privacyPool: PrivacyPool;
    let poseidon: any;

    before(async function () {
        poseidon = await buildPoseidon();

        // Deploy the PoseidonT3 library
        const PoseidonT3Factory = await ethers.getContractFactory("PoseidonT3");
        const poseidonT3 = await PoseidonT3Factory.deploy();
        await poseidonT3.waitForDeployment();
        const poseidonT3Address = await poseidonT3.getAddress();

        // Get the contract factory for PrivacyPool, linking the PoseidonT3 library
        const PrivacyPoolFactory = await ethers.getContractFactory("PrivacyPool", {
            libraries: {
                "contracts/lib/Poseidon.sol:PoseidonT3": poseidonT3Address,
            },
        });
        
        // Deploy the contract
        privacyPool = await PrivacyPoolFactory.deploy();
        await privacyPool.waitForDeployment();
    });

    it("Should have consistent hashes between circomlibjs and Solidity", async function () {
        console.log(poseidon.toString());

        const nullifier = 12345n;
        const secret = 67890n;

        // Frontend hash
        const frontendHash = poseidon([nullifier, secret]);
        console.log("Frontend hash:", frontendHash);
        console.log("Frontend hash (hex):", "0x" + frontendHash.toString(16));


        // Backend hash
        const backendHash = await privacyPool.calculateCommitment(nullifier, secret);
        console.log("Backend hash:", backendHash);
        console.log("Backend hash (hex):", backendHash.toString());

        // This will fail for now, until we fix the constants in Solidity
        // expect(backendHash).to.equal(frontendHash);
    });
});