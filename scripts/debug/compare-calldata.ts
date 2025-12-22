import { ethers } from "hardhat";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🔍 Comparing Calldata\n");
  console.log("=".repeat(70));

  const iface = new ethers.Interface(PrivacyPoolABI.abi);

  // Dummy values (works)
  const calldata1 = iface.encodeFunctionData("withdraw", [
    [1n, 2n],
    [[3n, 4n], [5n, 6n]],
    [7n, 8n],
    ethers.ZeroHash,
    ethers.ZeroHash,
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  ]);

  // Real proof values (fails)
  const calldata2 = iface.encodeFunctionData("withdraw", [
    [
      1219632802242378569348904070187318537054360447914226621449396516943764551490n,
      15765281570844590047650999214938467102683654258079684103874805462884766209510n
    ],
    [
      [
        21171379809543737960627458471200946587901995704684184323236903013153165815494n,
        4946798544321939033410725703752343823821357064979304249936212623125003538666n
      ],
      [
        67462765853742468387396459958829101008801706603916977591435881532120525580n,
        1702516662983874656968834704830976855114412522701734134310149093848196592171n
      ]
    ],
    [
      10746288356358800873747328510906129191765719325136807879473847601680506423766n,
      20143391612546409924819384957266855400763652196331806573520256517416857461417n
    ],
    "0x0467f75ea1b1ea95a52058ef3e29d6e09f4258eac424199d5ca9061f781858ed",
    "0x24a3b855d0a89ad666e353ca484cac657c15f27b444cbbbd55d72db12bd7825f",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    0n,
    ethers.ZeroAddress
  ]);

  console.log("📋 Dummy values calldata:");
  console.log(`  Length: ${calldata1.length}`);
  console.log(`  Selector: ${calldata1.slice(0, 10)}`);
  console.log(`  First 200 chars: ${calldata1.slice(0, 200)}`);

  console.log("\n📋 Real proof calldata:");
  console.log(`  Length: ${calldata2.length}`);
  console.log(`  Selector: ${calldata2.slice(0, 10)}`);
  console.log(`  First 200 chars: ${calldata2.slice(0, 200)}`);

  console.log("\n🔍 Comparison:");
  console.log(`  Same length: ${calldata1.length === calldata2.length ? "✅" : "❌"}`);
  console.log(`  Same selector: ${calldata1.slice(0, 10) === calldata2.slice(0, 10) ? "✅" : "❌"}`);

  // Save to files for detailed comparison
  const fs = require('fs');
  fs.writeFileSync('calldata-dummy.txt', calldata1);
  fs.writeFileSync('calldata-real.txt', calldata2);
  console.log("\n📝 Calldata saved to:");
  console.log(`  calldata-dummy.txt`);
  console.log(`  calldata-real.txt`);

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
