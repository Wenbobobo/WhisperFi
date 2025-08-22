// scripts/test-withdraw-simple.js
// 这个脚本用于测试withdraw功能的核心逻辑，不涉及ZK证明生成

const { ethers } = require("ethers");

async function testWithdraw() {
  console.log("=== Withdraw Test Script (Simple) ===");
  
  // 1. 模拟从deposit获得的note
  // 这是一个真实的note示例
  const note = "private-defi-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890-v1";
  console.log("Using note:", note);
  
  // 2. 解析note
  const parts = note.split("-");
  if (parts.length !== 5 || parts[0] !== "private" || parts[1] !== "defi") {
    throw new Error(
      "Invalid note format. Expected format: private-defi-<secret>-<nullifier>-v1"
    );
  }
  const secret = "0x" + parts[2];
  const nullifier = "0x" + parts[3];
  console.log("Parsed secret:", secret);
  console.log("Parsed nullifier:", nullifier);
  
  // 3. 检查secret的格式
  console.log("Secret type:", typeof secret);
  console.log("Secret starts with 0x:", secret.startsWith("0x"));
  
  // 4. 检查nullifier的格式
  console.log("Nullifier type:", typeof nullifier);
  console.log("Nullifier starts with 0x:", nullifier.startsWith("0x"));
  
  // 5. 模拟合约调用参数检查
  // 这些是用户报告的错误中出现的参数
  const testArgs = [
    ["16871461915341846775065319063022792046502076074876496341968450484346993572493","11211172744209433301831545276566438204742009334968675111286468237243515976681"], 
    [["6192779636726983720241514591272444476318267799383778755410728661393167333841","4563155825026707083340653821381795770100374356985343243834267910839883184285"],["7606618430227683327579562058079159909168383511503530089679656276815466559270","8993795167722236209654725303809031548919542704099898884240787432672753547512"]], 
    ["16838814166055716017257507886315448194593995025055047931354791824751910691503","4613901304175454807132606280775099774384923265900533625657646218836340753704"], 
    "0x2c7d431f7f7405f42a1cd8e9d13d0506a29bc151da7b571ebdb124ecc0379a4d", 
    "0x0ba17063a1b00569ee80e6cff4cbd7ca1276687949251b82da5bf40df7e496d7", 
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", 
    0, 
    "0x0000000000000000000000000000000000000000"
  ];
  
  console.log("Test arguments:", testArgs);
  
  // 6. 检查参数类型
  console.log("Argument types:");
  testArgs.forEach((arg, index) => {
    console.log(`  Arg ${index}:`, typeof arg, Array.isArray(arg) ? `(array)` : ``);
  });
  
  // 7. 特别检查地址参数
  console.log("Address arguments:");
  console.log("  Recipient:", testArgs[5], "Valid address?", ethers.isAddress(testArgs[5]));
  console.log("  Relayer:", testArgs[7], "Valid address?", ethers.isAddress(testArgs[7]));
  
  // 8. 检查数值参数
  console.log("Numeric arguments:");
  console.log("  Fee:", testArgs[6], "Type:", typeof testArgs[6]);
  
  // 9. 检查bytes32参数
  console.log("Bytes32 arguments:");
  console.log("  Proof root:", testArgs[3], "Valid bytes32?", isValidBytes32(testArgs[3]));
  console.log("  Nullifier:", testArgs[4], "Valid bytes32?", isValidBytes32(testArgs[4]));
  
  console.log("=== Test completed ===");
}

function isValidBytes32(value) {
  if (typeof value !== 'string') return false;
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

// 运行测试
testWithdraw().catch(console.error);