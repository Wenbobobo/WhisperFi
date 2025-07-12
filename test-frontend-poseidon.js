// 简化的哈希一致性测试 - 只测试前端部分
const { buildPoseidon } = require('circomlibjs');

async function testFrontendPoseidon() {
  console.log('=== 前端Poseidon测试 ===\n');

  try {
    // 初始化Poseidon
    console.log('初始化Poseidon...');
    const poseidon = await buildPoseidon();
    console.log('✓ Poseidon初始化成功\n');

    // 测试用例
    const testCases = [
      {
        name: '零值测试',
        input1: 0n,
        input2: 0n
      },
      {
        name: '小数值测试', 
        input1: 1n,
        input2: 2n
      },
      {
        name: '真实commitment测试',
        input1: BigInt('8175042333908131853555108599311849679722172756805630201899011284758317870395'),
        input2: BigInt('0')
      }
    ];

    console.log('执行测试用例:\n');

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`${i + 1}. ${testCase.name}`);
      console.log(`   输入: [${testCase.input1}, ${testCase.input2}]`);

      const result = poseidon([testCase.input1, testCase.input2]);
      const hash = poseidon.F.toString(result);
      console.log(`   结果: ${hash}`);

      // 验证结果是否在正确的字段范围内
      const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
      const isInField = BigInt(hash) < fieldModulus;
      console.log(`   在BN128字段内: ${isInField ? '✓' : '✗'}`);
      console.log('');
    }

    console.log('=== 前端测试完成 ===');

  } catch (error) {
    console.error('错误:', error);
  }
}

testFrontendPoseidon();
