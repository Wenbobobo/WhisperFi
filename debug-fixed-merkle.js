const { buildPoseidon } = require("circomlibjs");
const { MerkleTree } = require("fixed-merkle-tree");

async function debugFixedMerkleTree() {
    console.log("=== Fixed Merkle Tree Debug Analysis ===\n");
    
    // Test data from the error log
    const commitments = [
        '0x210b676e5eed34a320caccb4267774011eb0c10ea15fa5a54a760943ca2d50f8',
        '0x09f53a52d0f8ef6abfe07c7c02b5e2f71e9c4bfcd9eed19888ae674c969575e9',
        '0x06ce3a6443ba327e7a70bf1becbd504a9c610e0fad75fd697868c5e4a29451d5',
        '0x11432c53dc11f198545006d20fbc1bb6f24d1eba7a0f274fa7bb32a823ae5fac',
        '0x2a645e10581a970f1bb6867eba12cd5f0faa73d5bcf1e18c62085db218317448',
        '0x011674613bb161fba601ce7c24f5378ea12324954634352ec4c17f363bd03e4d',
        '0x23b12c93ff767bc7c907bdbfb8d2ccbe5d6df785d40e7ef7d6d374aa1ac6cc70',
        '0x262b2bfdb93c305e4492f68c25b2999b73f08fe0a6b51df8b54d91e57337e19a',
        '0x07372cdd57d2d63c65c6146817f55c36aa938e062efc3fb262f36fbe3b318808',
        '0x013f111d0ba711db334a7ca22bde79fcb069f6f691f34d6195a4c2349dca07e3',
        '0x00f833057051c5d0c83c5cb5b8c1560b4b361efd452e0dd307f4be43c5801825',
        '0x25682420fa0d5482c93fc448897535b3469032cff30989d98a7bd846267641b3',
        '0x1877c279c744ef601a7046ac5787b4114950e2a799274c42dc7163157ac84c52'
    ];
    
    const targetCommitment = '0x1877c279c744ef601a7046ac5787b4114950e2a799274c42dc7163157ac84c52';
    const expectedRoot = '13319769232936133538395139558612715191939395749156603739227257592084168377819';
    
    console.log("1. Input Data:");
    console.log("   Commitments count:", commitments.length);
    console.log("   Target commitment:", targetCommitment);
    console.log("   Expected root:", expectedRoot);
    
    // Initialize Poseidon
    const poseidon = await buildPoseidon();
    
    // Define hash function exactly as in frontend
    const hashFunction = (left, right) => {
        const result = poseidon([BigInt(left), BigInt(right)]);
        return poseidon.F.toString(result);
    };
    
    console.log("\n2. Creating Merkle Tree:");
    console.log("   Using fixed-merkle-tree library");
    console.log("   Tree height: 20");
    console.log("   Zero element: '0'");
    
    // Create tree exactly as in frontend
    const tree = new MerkleTree(20, commitments, { 
        hashFunction, 
        zeroElement: '0'
    });
    
    console.log("   Tree created successfully");
    console.log("   Tree root:", tree.root);
    console.log("   Tree root type:", typeof tree.root);
    
    // Check if roots match
    const rootMatches = tree.root.toString() === expectedRoot;
    console.log("   Root matches expected:", rootMatches);
    
    if (!rootMatches) {
        console.log("   ❌ ROOT MISMATCH DETECTED!");
        console.log("   Expected:", expectedRoot);
        console.log("   Actual:  ", tree.root.toString());
    }
    
    // Find commitment index
    const leafIndex = commitments.findIndex(c => c === targetCommitment);
    console.log("\n3. Target Commitment:");
    console.log("   Index:", leafIndex);
    console.log("   Found:", leafIndex >= 0);
    
    if (leafIndex < 0) {
        console.log("   ❌ TARGET COMMITMENT NOT FOUND!");
        return;
    }
    
    // Generate path
    console.log("\n4. Generating Merkle Path:");
    const { pathElements, pathIndices } = tree.path(leafIndex);
    
    console.log("   Path elements length:", pathElements.length);
    console.log("   Path indices length:", pathIndices.length);
    console.log("   Path elements:", pathElements.map(el => el.toString().substring(0, 20) + "..."));
    console.log("   Path indices:", pathIndices);
    
    // Verify path manually
    console.log("\n5. Manual Path Verification:");
    let currentHash = BigInt(targetCommitment);
    console.log("   Starting with:", currentHash.toString());
    
    for (let i = 0; i < pathElements.length; i++) {
        const pathElement = BigInt(pathElements[i]);
        const isRight = pathIndices[i] === 1;
        
        const left = isRight ? pathElement : currentHash;
        const right = isRight ? currentHash : pathElement;
        
        const nextHash = poseidon([left, right]);
        currentHash = BigInt(poseidon.F.toString(nextHash));
        
        console.log(`   Level ${i}: ${isRight ? 'R' : 'L'} -> ${currentHash.toString().substring(0, 20)}...`);
    }
    
    console.log("\n6. Final Verification:");
    console.log("   Computed root:", currentHash.toString());
    console.log("   Expected root:", expectedRoot);
    console.log("   Tree lib root:", tree.root.toString());
    console.log("   Manual = Expected:", currentHash.toString() === expectedRoot);
    console.log("   Manual = Tree:", currentHash.toString() === tree.root.toString());
    
    // Test with a known working case
    console.log("\n7. Testing with Simple Case:");
    const simpleCommitments = [targetCommitment];
    const simpleTree = new MerkleTree(20, simpleCommitments, { 
        hashFunction, 
        zeroElement: '0'
    });
    
    console.log("   Simple tree root:", simpleTree.root.toString());
    const simplePath = simpleTree.path(0);
    console.log("   Simple path elements length:", simplePath.pathElements.length);
    console.log("   Simple path indices:", simplePath.pathIndices);
    
    // Check zero element handling
    console.log("\n8. Zero Element Analysis:");
    const zeroHash = hashFunction('0', '0');
    console.log("   Hash of (0,0):", zeroHash);
    console.log("   Hash of (commitment,0):", hashFunction(targetCommitment, '0'));
    
    return {
        treeRoot: tree.root.toString(),
        expectedRoot,
        pathElements: pathElements.map(el => el.toString()),
        pathIndices,
        verified: currentHash.toString() === tree.root.toString(),
        rootMatches
    };
}

debugFixedMerkleTree().catch(console.error);
