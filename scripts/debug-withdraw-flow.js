// scripts/debug-withdraw-flow.js
// 这个脚本用于模拟完整的withdraw流程并诊断问题

const { ethers } = require("ethers");

async function debugWithdrawFlow() {
  console.log("=== Withdraw Flow Debug Script ===");
  
  // 模拟组件的初始状态
  let state = {
    note: "",
    proof: null,
    publicSignals: null,
    address: null,
    chain: null,
    activeStep: 0,
    isProving: false
  };
  
  console.log("初始状态:", state);
  
  // 模拟handleWithdraw函数
  function handleWithdraw() {
    console.log("\n--- handleWithdraw 被调用 ---");
    console.log("当前状态:", {
      proof: state.proof ? "已设置" : "未设置",
      publicSignals: state.publicSignals ? "已设置" : "未设置",
      address: state.address ? "已设置" : "未设置",
      chain: state.chain ? "已设置" : "未设置"
    });
    
    if (!state.proof || !state.publicSignals || !state.address || !state.chain) {
      console.log("❌ 错误: Proof, public signals, or wallet connection is missing.");
      return { success: false, error: "Proof, public signals, or wallet connection is missing." };
    }
    
    console.log("✅ 所有必需参数都已设置");
    return { success: true };
  }
  
  // 测试1: 初始状态下调用handleWithdraw
  console.log("\n=== 测试1: 初始状态 ===");
  let result = handleWithdraw();
  console.log("结果:", result);
  
  // 模拟用户输入note
  console.log("\n--- 用户输入note ---");
  state.note = "private-defi-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890-v1";
  console.log("更新后的note:", state.note);
  
  // 模拟钱包连接
  console.log("\n--- 钱包连接 ---");
  state.address = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
  state.chain = { id: 31337 }; // Hardhat network
  console.log("钱包地址:", state.address);
  console.log("网络:", state.chain);
  
  // 测试2: 钱包连接后但没有proof和publicSignals
  console.log("\n=== 测试2: 钱包连接但没有proof ===");
  result = handleWithdraw();
  console.log("结果:", result);
  
  // 模拟generateProof完成
  console.log("\n--- generateProof 完成 ---");
  state.proof = {
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
  
  state.publicSignals = [
    "2942509907109545333728831868852199052131191870731203262561049727222234798465",
    "5133821651857765862046888275186809763127510000345295688368576094132362646665"
  ];
  
  state.activeStep = 1; // 表示proof已生成
  
  console.log("Proof已生成:", state.proof ? "是" : "否");
  console.log("PublicSignals已生成:", state.publicSignals ? "是" : "否");
  
  // 测试3: 所有参数都已设置
  console.log("\n=== 测试3: 所有参数都已设置 ===");
  result = handleWithdraw();
  console.log("结果:", result);
  
  if (result.success) {
    // 模拟格式化proof和publicSignals
    console.log("\n--- 格式化参数 ---");
    try {
      const formattedProof = {
        a: [state.proof.pi_a[0].toString(), state.proof.pi_a[1].toString()],
        b: [
          [state.proof.pi_b[0][0].toString(), state.proof.pi_b[0][1].toString()],  // 正确的顺序
          [state.proof.pi_b[1][0].toString(), state.proof.pi_b[1][1].toString()],  // 正确的顺序
        ],
        c: [state.proof.pi_c[0].toString(), state.proof.pi_c[1].toString()],
      };
      
      console.log("格式化后的proof:", JSON.stringify(formattedProof, null, 2));
      
      // 格式化public signals
      const rootFromSignal = BigInt(state.publicSignals[0]);
      const nullifierFromSignal = BigInt(state.publicSignals[1]);
      
      const rootBytes32 = ethers.toBeHex(rootFromSignal, 32);
      const nullifierBytes32 = ethers.toBeHex(nullifierFromSignal, 32);
      
      console.log("Merkle Root (bytes32):", rootBytes32);
      console.log("Nullifier (bytes32):", nullifierBytes32);
      
      // 准备最终参数
      const finalArgs = [
        formattedProof.a,
        formattedProof.b,
        formattedProof.c,
        rootBytes32,
        nullifierBytes32,
        state.address,
        BigInt(0), // fee
        ethers.ZeroAddress, // relayer
      ];
      
      console.log("\n最终参数:", finalArgs);
      console.log("✅ 所有参数准备完成，可以调用合约");
      
    } catch (error) {
      console.error("❌ 格式化参数时出错:", error.message);
      return;
    }
  }
  
  // 模拟可能的问题场景
  console.log("\n=== 模拟可能的问题场景 ===");
  
  // 场景1: proof为null
  console.log("\n--- 场景1: proof为null ---");
  const originalProof = state.proof;
  state.proof = null;
  result = handleWithdraw();
  console.log("结果:", result);
  state.proof = originalProof; // 恢复
  
  // 场景2: publicSignals为null
  console.log("\n--- 场景2: publicSignals为null ---");
  const originalPublicSignals = state.publicSignals;
  state.publicSignals = null;
  result = handleWithdraw();
  console.log("结果:", result);
  state.publicSignals = originalPublicSignals; // 恢复
  
  // 场景3: address为null
  console.log("\n--- 场景3: address为null ---");
  const originalAddress = state.address;
  state.address = null;
  result = handleWithdraw();
  console.log("结果:", result);
  state.address = originalAddress; // 恢复
  
  // 场景4: chain为null
  console.log("\n--- 场景4: chain为null ---");
  const originalChain = state.chain;
  state.chain = null;
  result = handleWithdraw();
  console.log("结果:", result);
  state.chain = originalChain; // 恢复
  
  console.log("\n=== 调试完成 ===");
}

// 运行调试
debugWithdrawFlow().catch(console.error);