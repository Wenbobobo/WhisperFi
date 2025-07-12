// Hash Consistency Test
// 测试前端circomlibjs和合约PoseidonT3是否产生相同的哈希结果

const { buildPoseidon } = require('circomlibjs');
const { ethers } = require('hardhat');

async function testHashConsistency() {
  console.log('=== 哈希一致性测试 ===\n');

  // 1. 初始化前端Poseidon
  console.log('1. 初始化前端Poseidon...');
  const poseidon = await buildPoseidon();
  console.log('   ✓ 前端Poseidon初始化完成\n');

  // 2. 部署合约并获取PoseidonT3实例
  console.log('2. 部署测试合约...');
  const PoseidonT3Factory = await ethers.getContractFactory('PoseidonT3');
  const poseidonContract = await PoseidonT3Factory.deploy();
  await poseidonContract.waitForDeployment();
  console.log('   ✓ PoseidonT3合约部署完成:', await poseidonContract.getAddress());
  console.log('');

  // 3. 测试用例
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
      name: '大数值测试',
      input1: BigInt('12345678901234567890'),
      input2: BigInt('98765432109876543210')
    },
    {
      name: '真实commitment测试',
      input1: BigInt('8175042333908131853555108599311849679722172756805630201899011284758317870395'),
      input2: BigInt('0')
    },
    {
      name: '两个commitment测试',
      input1: BigInt('8175042333908131853555108599311849679722172756805630201899011284758317870395'),
      input2: BigInt('4293953647789117937979294483098317889782348404923555839435689930607973263466')
    }
  ];

  console.log('3. 执行测试用例...\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`测试用例 ${i + 1}: ${testCase.name}`);
    console.log(`   输入: [${testCase.input1}, ${testCase.input2}]`);

    try {
      // 前端计算
      const frontendResult = poseidon([testCase.input1, testCase.input2]);
      const frontendHash = poseidon.F.toString(frontendResult);
      console.log(`   前端结果: ${frontendHash}`);

      // 合约计算
      const contractResult = await poseidonContract.poseidon([testCase.input1, testCase.input2]);
      const contractHash = contractResult.toString();
      console.log(`   合约结果: ${contractHash}`);

      // 比较结果
      const isMatch = frontendHash === contractHash;
      console.log(`   结果匹配: ${isMatch ? '✓ 是' : '✗ 否'}`);
      
      if (!isMatch) {
        console.log(`   ❌ 差异: ${BigInt(frontendHash) - BigInt(contractHash)}`);
      }

    } catch (error) {
      console.log(`   ❌ 错误: ${error.message}`);
    }

    console.log('');
  }

  console.log('=== 测试完成 ===');
}

// 执行测试
testHashConsistency()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });
