const { MerkleTree } = require('fixed-merkle-tree');
const { buildPoseidon } = require('circomlibjs');

async function debugMerkleTree() {
  const poseidon = await buildPoseidon();
  
  // 模拟一些承诺
  const commitments = [
    '123456789',
    '987654321',
    '555666777'
  ];
  
  // 使用 Poseidon 哈希构建 Merkle 树
  const tree = new MerkleTree(20, commitments, {
    hashFunction: (left, right) => poseidon.F.toString(poseidon([left, right]))
  });
  
  console.log('Tree root:', tree.root);
  console.log('Commitments:', commitments);
  
  // 获取第一个承诺的证明路径
  const path = tree.path(0);
  console.log('Merkle path for commitment 0:');
  console.log('Path elements:', path.pathElements);
  console.log('Path indices:', path.pathIndices);
  
  // 手动验证
  let current = commitments[0];
  console.log('\nManual verification:');
  console.log('Starting with leaf:', current);
  
  for (let i = 0; i < path.pathElements.length; i++) {
    const sibling = path.pathElements[i];
    const isRight = path.pathIndices[i];
    
    if (isRight === 0) {
      // Current is left, sibling is right
      current = poseidon.F.toString(poseidon([current, sibling]));
      console.log(`Level ${i}: hash(${current.substring(0,10)}..., ${sibling.substring(0,10)}...) = ${current.substring(0,10)}...`);
    } else {
      // Current is right, sibling is left
      current = poseidon.F.toString(poseidon([sibling, current]));
      console.log(`Level ${i}: hash(${sibling.substring(0,10)}..., ${current.substring(0,10)}...) = ${current.substring(0,10)}...`);
    }
  }
  
  console.log('Final root:', current);
  console.log('Tree root:', tree.root);
  console.log('Match:', current === tree.root);
}

debugMerkleTree().catch(console.error);
