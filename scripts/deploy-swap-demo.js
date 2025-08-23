// scripts/deploy-swap-demo.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SimpleSwapDemo contract...");

  // Deploy the SimpleSwapDemo contract
  const SimpleSwapDemo = await ethers.getContractFactory("SimpleSwapDemo");
  const swapDemo = await SimpleSwapDemo.deploy();
  
  await swapDemo.waitForDeployment();
  const swapDemoAddress = await swapDemo.getAddress();

  console.log(`SimpleSwapDemo deployed to: ${swapDemoAddress}`);

  // Update contracts config
  const fs = require('fs');
  const contractsPath = './frontend/src/config/contracts.ts';
  
  let contractsContent = fs.readFileSync(contractsPath, 'utf8');
  
  // Add the new contract address
  const newLine = `  "SIMPLE_SWAP_DEMO_ADDRESS": "${swapDemoAddress}",`;
  contractsContent = contractsContent.replace(
    'export const CONTRACTS = {',
    `export const CONTRACTS = {\n${newLine}`
  );
  
  fs.writeFileSync(contractsPath, contractsContent);
  
  console.log("Updated contracts.ts with SimpleSwapDemo address");
  
  // Test a demo swap
  console.log("\nTesting demo swap...");
  
  const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
  const USDC_ADDRESS = "0x1000000000000000000000000000000000000001";
  
  // Execute a demo swap: 0.1 ETH -> USDC
  const swapTx = await swapDemo.swapDemo(
    ETH_ADDRESS,
    USDC_ADDRESS,
    ethers.parseEther("0.1"),
    { value: ethers.parseEther("0.001") } // Small gas fee
  );
  
  const receipt = await swapTx.wait();
  console.log(`Demo swap transaction: ${receipt.hash}`);
  
  // Find the SwapExecuted event
  const swapEvent = receipt.logs.find(log => {
    try {
      const parsed = swapDemo.interface.parseLog(log);
      return parsed && parsed.name === 'SwapExecuted';
    } catch (e) {
      return false;
    }
  });
  
  if (swapEvent) {
    const parsed = swapDemo.interface.parseLog(swapEvent);
    console.log(`Swap executed: ${ethers.formatEther(parsed.args.amountIn)} ETH -> ${ethers.formatEther(parsed.args.amountOut)} USDC`);
  }
  
  return {
    swapDemo: swapDemoAddress,
    testTxHash: receipt.hash
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
