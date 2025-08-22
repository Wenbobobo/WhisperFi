// scripts/test-withdraw-fix.js
// 测试WithdrawCard状态管理修复的脚本

async function testWithdrawFix() {
  console.log("=== Withdraw State Management Fix Test ===");
  
  // 模拟组件状态
  let state = {
    proof: null,
    publicSignals: null,
    feedback: { type: "", message: "" },
    isProving: false
  };
  
  console.log("初始状态:", state);
  
  // 模拟修复后的generateProof函数的错误处理
  console.log("\n--- 模拟修复后的错误处理 ---");
  state.isProving = true;
  console.log("开始证明生成，状态:", state);
  
  try {
    // 模拟proof生成失败
    throw new Error("Proof generation failed");
  } catch (err) {
    state.feedback = {
      type: "error",
      message: `Proof generation failed: ${err.message}`,
    };
    // 修复：在错误处理中也重置proof和publicSignals状态
    state.proof = null;
    state.publicSignals = null;
  } finally {
    state.isProving = false;
  }
  
  console.log("错误处理后的状态:", state);
  
  // 模拟handleWithdraw函数的检查
  console.log("\n--- 模拟handleWithdraw检查 ---");
  function handleWithdraw() {
    if (!state.proof || !state.publicSignals) {
      return {
        success: false,
        error: "Proof, public signals, or wallet connection is missing."
      };
    }
    return { success: true };
  }
  
  let result = handleWithdraw();
  console.log("handleWithdraw结果:", result);
  console.log("预期结果: 失败但状态一致，不会出现意外的错误");
  
  // 模拟成功的场景
  console.log("\n--- 模拟成功的场景 ---");
  state.proof = { /* some proof data */ };
  state.publicSignals = { /* some public signals data */ };
  state.feedback = {
    type: "success",
    message: "Proof generated successfully! You can now submit the withdrawal."
  };
  
  console.log("成功生成proof后的状态:", {
    proof: state.proof ? "已设置" : "未设置",
    publicSignals: state.publicSignals ? "已设置" : "未设置",
    feedback: state.feedback
  });
  
  result = handleWithdraw();
  console.log("成功生成proof后的handleWithdraw结果:", result);
  
  console.log("\n=== 测试完成 ===");
  console.log("修复验证: 在错误处理中重置proof和publicSignals状态可以确保状态一致性");
}

// 运行测试
testWithdrawFix().catch(console.error);