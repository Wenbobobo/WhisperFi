// scripts/fix-withdraw-state.js
// 这个脚本用于验证修复withdraw状态管理问题的方案

async function fixWithdrawState() {
  console.log("=== Withdraw State Fix Validation ===");
  
  // 模拟组件状态
  let state = {
    proof: null,
    publicSignals: null,
    feedback: { type: "", message: "" },
    isProving: false
  };
  
  console.log("初始状态:", state);
  
  // 模拟原始的错误处理方式
  console.log("\n--- 原始错误处理方式 ---");
  try {
    // 模拟proof生成失败
    throw new Error("Proof generation failed");
  } catch (err) {
    state.feedback = {
      type: "error",
      message: `Proof generation failed: ${err.message}`,
    };
    // 注意：这里没有重置proof和publicSignals状态
  } finally {
    state.isProving = false;
  }
  
  console.log("错误处理后的状态:", state);
  console.log("如果此时调用handleWithdraw，会显示'Proof, public signals, or wallet connection is missing'");
  
  // 模拟修复后的错误处理方式
  console.log("\n--- 修复后的错误处理方式 ---");
  state.proof = null;
  state.publicSignals = null;
  state.feedback = { type: "", message: "" };
  state.isProving = true;
  
  console.log("重置状态:", state);
  
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
  
  console.log("修复后的错误处理状态:", state);
  console.log("这样可以确保状态一致性");
  
  // 验证修复是否有效
  console.log("\n--- 验证修复 ---");
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
  console.log("修复后的handleWithdraw结果:", result);
  
  // 模拟成功的proof生成
  console.log("\n--- 模拟成功的proof生成 ---");
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
  
  console.log("\n=== 验证完成 ===");
  console.log("修复方案：在generateProof的catch块中重置proof和publicSignals状态");
}

// 运行验证
fixWithdrawState().catch(console.error);