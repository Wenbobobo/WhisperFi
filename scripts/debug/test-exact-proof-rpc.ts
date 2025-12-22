import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🧪 Testing Exact Proof Values via Raw RPC\n");
  console.log("=".repeat(70));

  // Use the exact values from the failed test
  const proofA = [
    1219632802242378569348904070187318537054360447914226621449396516943764551490n,
    15765281570844590047650999214938467102683654258079684103874805462884766209510n
  ];
  const proofB = [
    [
      21171379809543737960627458471200946587901995704684184323236903013153165815494n,
      4946798544321939033410725703752343823821357064979304249936212623125003538666n
    ],
    [
      67462765853742468387396459958829101008801706603916977591435881532120525580n,
      1702516662983874656968834704830976855114412522701734134310149093848196592171n
    ]
  ];
  const proofC = [
    10746288356358800873747328510906129191765719325136807879473847601680506423766n,
    20143391612546409924819384957266855400763652196331806573520256517416857461417n
  ];

  const merkleRoot = "0x0467f75ea1b1ea95a52058ef3e29d6e09f4258eac424199d5ca9061f781858ed";
  const nullifier = "0x24a3b855d0a89ad666e353ca484cac657c15f27b444cbbbd55d72db12bd7825f";
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  // Manually encode the function call
  const iface = new ethers.Interface(PrivacyPoolABI.abi);

  console.log("🔍 Encoding with exact proof values...");
  let calldata;
  try {
    calldata = iface.encodeFunctionData("withdraw", [
      proofA,
      proofB,
      proofC,
      merkleRoot,
      nullifier,
      recipient,
      fee,
      relayer
    ]);
    console.log(`✅ Encoding successful`);
    console.log(`  Selector: ${calldata.slice(0, 10)}`);
    console.log(`  Calldata length: ${calldata.length}`);
  } catch (error: any) {
    console.log(`❌ Encoding failed: ${error.message}`);
    return;
  }

  // Try eth_call
  console.log("\n📞 Making eth_call with real proof values...");
  try {
    const result = await ethers.provider.send("eth_call", [
      {
        to: CONTRACTS.PRIVACY_POOL_ADDRESS,
        data: calldata
      },
      "latest"
    ]);
    console.log("✅ SUCCESS! Result:", result);
  } catch (error: any) {
    console.log("❌ FAILED!");
    if (error.data && error.data.message) {
      console.log("  Error message:", error.data.message);
      if (error.data.message.includes("function selector")) {
        console.log("  ⚠️  FUNCTION SELECTOR NOT RECOGNIZED");
      } else {
        console.log("  ✅ Function was recognized, but execution failed (expected)");
      }
    } else {
      console.log("  Error:", error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
