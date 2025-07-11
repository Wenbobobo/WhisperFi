const { buildPoseidon } = require("circomlibjs");

async function debugMerkleTree() {
    console.log("=== Merkle Tree Debug Analysis ===\n");
    
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
    console.log("   Target index:", commitments.indexOf(targetCommitment));
    
    // Initialize Poseidon
    const poseidon = await buildPoseidon();
    
    // Convert commitments to BigInt
    const leaves = commitments.map(c => BigInt(c));
    const targetLeaf = BigInt(targetCommitment);
    const leafIndex = leaves.indexOf(targetLeaf);
    
    console.log("\n2. Leaf Analysis:");
    console.log("   Target leaf (BigInt):", targetLeaf.toString());
    console.log("   Leaf index:", leafIndex);
    
    // Build Merkle tree manually
    const TREE_HEIGHT = 20;
    const ZERO_VALUE = BigInt(0);
    
    // Create layers
    let currentLayer = [...leaves];
    const layers = [currentLayer];
    
    console.log("\n3. Building Merkle Tree:");
    console.log("   Initial layer size:", currentLayer.length);
    
    for (let level = 0; level < TREE_HEIGHT; level++) {
        const nextLayer = [];
        
        // Pad current layer to even length with zeros
        if (currentLayer.length % 2 === 1) {
            currentLayer.push(ZERO_VALUE);
        }
        
        // Hash pairs
        for (let i = 0; i < currentLayer.length; i += 2) {
            const left = currentLayer[i];
            const right = currentLayer[i + 1] || ZERO_VALUE;
            const hash = poseidon.F.toString(poseidon([left, right]));
            nextLayer.push(BigInt(hash));
        }
        
        layers.push(nextLayer);
        currentLayer = nextLayer;
        
        console.log(`   Level ${level + 1}: ${nextLayer.length} nodes`);
        
        if (nextLayer.length === 1) break;
    }
    
    const computedRoot = currentLayer[0];
    console.log("\n4. Root Comparison:");
    console.log("   Computed root:", computedRoot.toString());
    console.log("   Expected root:", expectedRoot);
    console.log("   Roots match:", computedRoot.toString() === expectedRoot);
    
    // Generate path for target leaf
    console.log("\n5. Path Generation for Target Leaf:");
    let currentIndex = leafIndex;
    const pathElements = [];
    const pathIndices = [];
    
    for (let level = 0; level < TREE_HEIGHT; level++) {
        const currentLayerSize = layers[level].length;
        
        if (currentIndex >= currentLayerSize) {
            console.log(`   ERROR: Index ${currentIndex} out of bounds for layer ${level} (size: ${currentLayerSize})`);
            break;
        }
        
        const isRightNode = currentIndex % 2 === 1;
        const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
        
        let sibling;
        if (siblingIndex < layers[level].length) {
            sibling = layers[level][siblingIndex];
        } else {
            sibling = ZERO_VALUE;
        }
        
        pathElements.push(sibling.toString());
        pathIndices.push(isRightNode ? 1 : 0);
        
        console.log(`   Level ${level}: index=${currentIndex}, sibling=${sibling.toString().substring(0, 20)}...`);
        
        currentIndex = Math.floor(currentIndex / 2);
    }
    
    console.log("\n6. Path Verification:");
    console.log("   Path elements length:", pathElements.length);
    console.log("   Path indices length:", pathIndices.length);
    
    // Verify path manually
    let hash = targetLeaf;
    console.log("   Starting with leaf:", hash.toString());
    
    for (let i = 0; i < pathElements.length && i < TREE_HEIGHT; i++) {
        const pathElement = BigInt(pathElements[i]);
        const isRight = pathIndices[i] === 1;
        
        const left = isRight ? pathElement : hash;
        const right = isRight ? hash : pathElement;
        
        hash = BigInt(poseidon.F.toString(poseidon([left, right])));
        
        console.log(`   Level ${i}: ${isRight ? 'right' : 'left'} -> ${hash.toString().substring(0, 20)}...`);
    }
    
    console.log("\n7. Final Verification:");
    console.log("   Computed final hash:", hash.toString());
    console.log("   Expected root:", expectedRoot);
    console.log("   Path verification:", hash.toString() === expectedRoot ? "PASS" : "FAIL");
    
    // Check for common issues
    console.log("\n8. Common Issues Check:");
    
    // Check if we have duplicate commitments
    const uniqueCommitments = new Set(commitments);
    console.log("   Unique commitments:", uniqueCommitments.size);
    console.log("   Has duplicates:", uniqueCommitments.size !== commitments.length);
    
    // Check commitment format
    const invalidCommitments = commitments.filter(c => !c.startsWith('0x') || c.length !== 66);
    console.log("   Invalid format commitments:", invalidCommitments.length);
    
    // Check if target exists in tree
    console.log("   Target exists in tree:", commitments.includes(targetCommitment));
    
    return {
        computedRoot: computedRoot.toString(),
        expectedRoot,
        pathElements,
        pathIndices,
        verified: hash.toString() === expectedRoot
    };
}

debugMerkleTree().catch(console.error);
