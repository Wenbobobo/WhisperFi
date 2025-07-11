// scripts/test-commitment.js
const { ethers } = require("hardhat");
const { buildPoseidon } = require("circomlibjs");

async function main() {
    // Initialize Poseidon
    const poseidon = await buildPoseidon();
    
    // Test parameters
    const secret = "my-test-secret";
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
    const amount = ethers.parseEther('0.1');
    
    console.log("🔍 Testing commitment generation...");
    console.log("Secret:", secret);
    console.log("Secret hash:", secretHash);
    console.log("Amount:", amount.toString());
    
    // Generate commitment using Poseidon(secret, amount)
    function hexToBigInt(hex) {
        return BigInt(hex);
    }
    
    const hash = poseidon([hexToBigInt(secretHash), BigInt(amount.toString())]);
    const commitment = '0x' + poseidon.F.toObject(hash).toString(16).padStart(64, '0');
    
    console.log("Generated commitment:", commitment);
    
    // Deploy contracts and test
    const [deployer] = await ethers.getSigners();
    
    // Deploy Verifier first
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    
    // Deploy PrivacyPool
    const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
    const privacyPool = await PrivacyPool.deploy(
        await verifier.getAddress(),
        ethers.ZeroHash, // zero value for Merkle tree
        await deployer.getAddress()
    );
    await privacyPool.waitForDeployment();
    
    console.log("📦 Contracts deployed");
    console.log("PrivacyPool:", await privacyPool.getAddress());
    
    // Make a deposit
    console.log("💰 Making deposit...");
    const tx = await privacyPool.deposit(commitment, { value: amount });
    await tx.wait();
    
    console.log("✅ Deposit successful");
    
    // Get deposit events
    const depositEvents = await privacyPool.queryFilter(
        privacyPool.filters.Deposit()
    );
    
    console.log("📋 Deposit events:");
    depositEvents.forEach((event, index) => {
        console.log(`  ${index}: ${event.args.commitment}`);
    });
    
    // Check if our commitment matches
    const foundEvent = depositEvents.find(event => event.args.commitment === commitment);
    if (foundEvent) {
        console.log("✅ Commitment found in deposit events!");
        console.log("Leaf index:", foundEvent.args.leafIndex);
    } else {
        console.log("❌ Commitment NOT found in deposit events");
        console.log("Expected:", commitment);
        console.log("Available:", depositEvents.map(e => e.args.commitment));
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
