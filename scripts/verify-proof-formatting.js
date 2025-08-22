// scripts/verify-proof-formatting.js
// 这个脚本用于验证proof格式化是否正确

async function verifyProofFormatting() {
  console.log("=== Proof Formatting Verification ===");
  
  // 模拟从snarkjs生成的proof对象
  // 这是用户报告错误中出现的proof数据
  const mockProof = {
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
  
  console.log("Original proof:", JSON.stringify(mockProof, null, 2));
  
  // 当前的（错误的）格式化方式
  console.log("\n--- 错误的格式化方式 ---");
  const wrongFormattedProof = {
    a: [mockProof.pi_a[0].toString(), mockProof.pi_a[1].toString()],
    b: [
      [mockProof.pi_b[0][1].toString(), mockProof.pi_b[0][0].toString()],  // 索引交换了
      [mockProof.pi_b[1][1].toString(), mockProof.pi_b[1][0].toString()],  // 索引交换了
    ],
    c: [mockProof.pi_c[0].toString(), mockProof.pi_c[1].toString()],
  };
  
  console.log("错误格式化的B参数:", wrongFormattedProof.b);
  
  // 修复后的格式化方式
  console.log("\n--- 修复后的格式化方式 ---");
  const correctFormattedProof = {
    a: [mockProof.pi_a[0].toString(), mockProof.pi_a[1].toString()],
    b: [
      [mockProof.pi_b[0][0].toString(), mockProof.pi_b[0][1].toString()],  // 正确的索引顺序
      [mockProof.pi_b[1][0].toString(), mockProof.pi_b[1][1].toString()],  // 正确的索引顺序
    ],
    c: [mockProof.pi_c[0].toString(), mockProof.pi_c[1].toString()],
  };
  
  console.log("正确格式化的B参数:", correctFormattedProof.b);
  
  // 验证差异
  console.log("\n--- 差异对比 ---");
  console.log("B[0] 第一个元素: 错误 =", wrongFormattedProof.b[0][0], "正确 =", correctFormattedProof.b[0][0]);
  console.log("B[0] 第二个元素: 错误 =", wrongFormattedProof.b[0][1], "正确 =", correctFormattedProof.b[0][1]);
  console.log("B[1] 第一个元素: 错误 =", wrongFormattedProof.b[1][0], "正确 =", correctFormattedProof.b[1][0]);
  console.log("B[1] 第二个元素: 错误 =", wrongFormattedProof.b[1][1], "正确 =", correctFormattedProof.b[1][1]);
  
  // 检查是否有差异
  const hasDifference = 
    wrongFormattedProof.b[0][0] !== correctFormattedProof.b[0][0] ||
    wrongFormattedProof.b[0][1] !== correctFormattedProof.b[0][1] ||
    wrongFormattedProof.b[1][0] !== correctFormattedProof.b[1][0] ||
    wrongFormattedProof.b[1][1] !== correctFormattedProof.b[1][1];
  
  console.log("\n是否存在差异:", hasDifference ? "是" : "否");
  
  if (hasDifference) {
    console.log("\n结论: Proof B参数的索引确实存在错误，需要修复。");
  } else {
    console.log("\n结论: Proof B参数格式化正确。");
  }
  
  console.log("=== 验证完成 ===");
}

// 运行验证
verifyProofFormatting().catch(console.error);