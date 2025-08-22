// scripts/debug-withdraw-full.js
// 这个脚本用于完整地调试withdraw功能，包括proof生成和验证

const { ethers } = require("ethers");

async function debugWithdraw() {
  console.log("=== Withdraw Full Debug Script ===");
  
  // 模拟组件状态
  let proof = null;
  let publicSignals = null;
  let address = null;
  let chain = null;
  
  console.log("初始状态:");
  console.log("  proof:", proof);
  console.log("  publicSignals:", publicSignals);
  console.log("  address:", address);
  console.log("  chain:", chain);
  
  // 模拟handleWithdraw函数的检查
  console.log("\n--- 检查handleWithdraw的条件 ---");
  if (!proof || !publicSignals || !address || !chain) {
    console.log("❌ 错误: Proof, public signals, or wallet connection is missing.");
    console.log("  proof is null:", !proof);
    console.log("  publicSignals is null:", !publicSignals);
    console.log("  address is null:", !address);
    console.log("  chain is null:", !chain);
  } else {
    console.log("✅ 所有必需的参数都已设置");
  }
  
  // 模拟生成proof和publicSignals后的状态
  console.log("\n--- 模拟生成proof和publicSignals后的状态 ---");
  proof = {
    pi_a: [
      "16871461915341846775065319063022792046502076074876496341968450484346993572493",
      "11211172744209433301831545276566438204742009334968675111286468237243515976681"
    ],
    pi_b: [
      [
        "6192779636726983720241514591272444476318267799383778755410728661393167333841",
        "4563155825026707083340653821381795770100374356985343243834267910839883184285"
      ],
      [
        "7606618430227683327579562058079159909168383511503530089679656276815466559270",
        "8993795167722236209654725303809031548919542704099898884240787432672753547512"
      ]
    ],
    pi_c: [
      "16838814166055716017257507886315448194593995025055047931354791824751910691503",
      "4613901304175454807132606280775099774384923265900533625657646218836340753704"
    ]
  };
  
  publicSignals = [
    "2942509907109545333728831868852199052131191870731203262561049727222234798465",
    "5133821651857765862046888275186809763127510000345295688368576094132362646665"
  ];
  
  address = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
  chain = { id: 31337 }; // Hardhat network
  
  console.log("更新后的状态:");
  console.log("  proof:", proof ? "已设置" : "未设置");
  console.log("  publicSignals:", publicSignals ? "已设置" : "未设置");
  console.log("  address:", address ? "已设置" : "未设置");
  console.log("  chain:", chain ? "已设置" : "未设置");
  
  // 再次检查handleWithdraw的条件
  console.log("\n--- 再次检查handleWithdraw的条件 ---");
  if (!proof || !publicSignals || !address || !chain) {
    console.log("❌ 错误: Proof, public signals, or wallet connection is missing.");
    console.log("  proof is null:", !proof);
    console.log("  publicSignals is null:", !publicSignals);
    console.log("  address is null:", !address);
    console.log("  chain is null:", !chain);
  } else {
    console.log("✅ 所有必需的参数都已设置");
    
    // 模拟proof格式化
    console.log("\n--- 格式化proof ---");
    try {
      const formattedProof = {
        a: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
        b: [
          [proof.pi_b[0][0].toString(), proof.pi_b[0][1].toString()],  // 修复后的正确顺序
          [proof.pi_b[1][0].toString(), proof.pi_b[1][1].toString()],  // 修复后的正确顺序
        ],
        c: [proof.pi_c[0].toString(), proof.pi_c[1].toString()],
      };
      
      console.log("格式化后的proof:", JSON.stringify(formattedProof, null, 2));
      
      // 格式化public signals
      console.log("\n--- 格式化public signals ---");
      const rootFromSignal = BigInt(publicSignals[0]);
      const nullifierFromSignal = BigInt(publicSignals[1]);
      
      const rootBytes32 = ethers.toBeHex(rootFromSignal, 32);
      const nullifierBytes32 = ethers.toBeHex(nullifierFromSignal, 32);
      
      console.log("Merkle Root (bytes32):", rootBytes32);
      console.log("Nullifier (bytes32):", nullifierBytes32);
      
      // 准备最终参数
      console.log("\n--- 准备最终参数 ---");
      const finalArgs = [
        formattedProof.a,
        formattedProof.b,
        formattedProof.c,
        rootBytes32,
        nullifierBytes32,
        address,
        BigInt(0), // fee
        ethers.ZeroAddress, // relayer
      ];
      
      console.log("最终参数:", finalArgs);
      console.log("✅ 所有参数准备完成，可以调用合约");
      
    } catch (error) {
      console.error("❌ 格式化proof时出错:", error.message);
    }
  }
  
  console.log("\n=== 调试完成 ===");
}

// 运行调试
debugWithdraw().catch(console.error);