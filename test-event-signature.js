const { ethers } = require("ethers");

// 根据合约中的事件定义计算正确的签名
const depositEventSignature = ethers.id("Deposit(bytes32,uint32,uint256)");
console.log("Correct Deposit event signature:", depositEventSignature);

// 前端代码中期望的签名
const expectedSignature =
  "0x50d7c806502b19988de828b53142eb08d5707cdb9d1a86c7a9b20ed4bcd34e03";
console.log("Expected signature from frontend:", expectedSignature);

// 前端代码中计算出的签名
const computedSignature =
  "0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196";
console.log("Computed signature from frontend:", computedSignature);

console.log(
  "Signatures match correct:",
  depositEventSignature === computedSignature
);
console.log(
  "Expected matches computed:",
  expectedSignature === computedSignature
);
