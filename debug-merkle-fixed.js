const { MerkleTree } = require('fixed-merkle-tree');
const { buildPoseidon } = require('circomlibjs');

async function debugMerkleTree() {
  console.log('🔧 Initializing Poseidon...');
  const poseidon = await buildPoseidon();
  console.log('✅ Poseidon initialized');
  
  // 创建哈希函数
  const hashFunction = (left, right) => {
    const result = poseidon([BigInt(left), BigInt(right)]);
    return poseidon.F.toString(result);
  };
  
  // 模拟一些承诺 - 使用大整数格式
  const commitments = [
    '12345678901234567890',
    '98765432109876543210', 
    '55566677788899900011'
  ];
  
  console.log('\n🌳 Building Merkle tree...');
  console.log('Commitments:', commitments);
  
  // 使用 Poseidon 哈希构建 Merkle 树
  const tree = new MerkleTree(20, commitments, {
    hashFunction: hashFunction
  });
  
  console.log('Tree root:', tree.root);
  
  // 获取第一个承诺的证明路径
  const path = tree.path(0);
  console.log('\n📍 Merkle path for commitment 0:');
  console.log('Path elements:', path.pathElements);
  console.log('Path indices:', path.pathIndices);
  
  // 手动验证 Merkle 路径
  let current = commitments[0];
  console.log('\n🔍 Manual verification:');
  console.log('Starting with leaf:', current);
  
  for (let i = 0; i < path.pathElements.length; i++) {
    const sibling = path.pathElements[i];
    const isRight = path.pathIndices[i];
    
    console.log(`\nLevel ${i}:`);
    console.log(`  Current: ${current}`);
    console.log(`  Sibling: ${sibling}`);
    console.log(`  IsRight: ${isRight}`);
    
    if (isRight === 0) {
      // Current is left, sibling is right
      const newHash = hashFunction(current, sibling);
      console.log(`  hash(${current}, ${sibling}) = ${newHash}`);
      current = newHash;
    } else {
      // Current is right, sibling is left  
      const newHash = hashFunction(sibling, current);
      console.log(`  hash(${sibling}, ${current}) = ${newHash}`);
      current = newHash;
    }
  }
  
  console.log('\n📊 Results:');
  console.log('Computed root:', current);
  console.log('Tree root:   ', tree.root);
  console.log('Match:', current === tree.root ? '✅' : '❌');
  
  // 测试电路格式的输入
  console.log('\n🔬 Circuit input format:');
  const secretDecimal = BigInt('0x' + '111'.padStart(64, '0')).toString();
  const amountDecimal = '100000000000000000'; // 0.1 ETH in wei
  const merkleRootDecimal = BigInt(tree.root).toString();
  
  console.log('Secret (decimal):', secretDecimal);
  console.log('Amount (decimal):', amountDecimal);
  console.log('Root (decimal):', merkleRootDecimal);
  console.log('Path indices:', path.pathIndices);
}

debugMerkleTree().catch(console.error);
