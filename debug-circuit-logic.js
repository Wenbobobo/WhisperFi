const { buildPoseidon } = require("circomlibjs");

async function debugCircuitLogic() {
    console.log("=== Circuit Logic Debug Analysis ===\n");
    
    // Data from the error
    const targetCommitment = '0x1877c279c744ef601a7046ac5787b4114950e2a799274c42dc7163157ac84c52';
    const secret = '0xbc34320f7eff13bdf9b82ee68e13c81a9d8b14f5c91cb205d82ff4976a84e3';
    const amount = '100000000000000000'; // 0.1 ETH
    const nullifier = '0x24ed62fc7e3dc74a77fc12275efc0cdc0e90b948e0f414f4a95ede9b3edd9e';
    
    const pathElements = [
        '0',
        '14744269619966411208579211824598458697587494354926760081771325075741142829156',
        '12915725955914709442620130836227016886604777936222038579281010733579144864884',
        '10214682998902546044578314075520686239372730160930721575672938779383107075954',
        '3607627140608796879659380071776844901612302623152076817094415224584923813162',
        '19712377064642672829441595136074946683621277828620209496774504837737984048981',
        '20775607673010627194014556968476266066927294572720319469184847051418138353016',
        '3396914609616007258851405644437304192397291162432396347162513310381425243293',
        '21551820661461729022865262380882070649935529853313286572328683688269863701601',
        '6573136701248752079028194407151022595060682063033565181951145966236778420039',
        '12413880268183407374852357075976609371175688755676981206018884971008854919922',
        '14271763308400718165336499097156975241954733520325982997864342600795471836726',
        '20066985985293572387227381049700832219069292839614107140851619262827735677018',
        '9394776414966240069580838672673694685292165040808226440647796406499139370960',
        '11331146992410411304059858900317123658895005918277453009197229807340014528524',
        '15819538789928229930262697811477882737253464456578333862691129291651619515538',
        '19217088683336594659449020493828377907203207941212636669271704950158751593251',
        '21035245323335827719745544373081896983162834604456827698288649288827293579666',
        '6939770416153240137322503476966641397417391950902474480970945462551409848591',
        '10941962436777715901943463195175331263348098796018438960955633645115732864202'
    ];
    
    const pathIndices = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const merkleRoot = '13319769232936133538395139558612715191939395749156603739227257592084168377819';
    
    console.log("1. Input Analysis:");
    console.log("   Secret:", secret);
    console.log("   Amount:", amount);
    console.log("   Target commitment:", targetCommitment);
    console.log("   Merkle root:", merkleRoot);
    console.log("   Path elements length:", pathElements.length);
    console.log("   Path indices length:", pathIndices.length);
    
    // Initialize Poseidon
    const poseidon = await buildPoseidon();
    
    // 1. Check commitment generation
    console.log("\n2. Commitment Generation:");
    const secretBigInt = BigInt(secret);
    const amountBigInt = BigInt(amount);
    
    console.log("   Secret (BigInt):", secretBigInt.toString());
    console.log("   Amount (BigInt):", amountBigInt.toString());
    
    const commitmentResult = poseidon([secretBigInt, amountBigInt]);
    const calculatedCommitment = poseidon.F.toString(commitmentResult);
    
    console.log("   Calculated commitment:", calculatedCommitment);
    console.log("   Expected commitment:", BigInt(targetCommitment).toString());
    console.log("   Commitments match:", calculatedCommitment === BigInt(targetCommitment).toString());
    
    // 2. Check nullifier generation  
    console.log("\n3. Nullifier Generation:");
    const nullifierResult = poseidon([secretBigInt]);
    const calculatedNullifier = poseidon.F.toString(nullifierResult);
    
    console.log("   Calculated nullifier:", calculatedNullifier);
    console.log("   Expected nullifier:", BigInt(nullifier).toString());
    console.log("   Nullifiers match:", calculatedNullifier === BigInt(nullifier).toString());
    
    // 3. Check merkle path verification (circuit logic)
    console.log("\n4. Circuit-Style Merkle Verification:");
    let currentHash = BigInt(calculatedCommitment);
    console.log("   Starting with commitment:", currentHash.toString().substring(0, 20) + "...");
    
    for (let i = 0; i < pathElements.length; i++) {
        const pathElement = BigInt(pathElements[i]);
        const pathIndex = pathIndices[i];
        
        // Circuit logic: path[i] = 0 means current is left, path[i] = 1 means current is right
        // But this seems wrong in the circuit! Let me check the actual circuit logic
        
        // Standard Merkle tree: pathIndex = 0 means sibling is right, pathIndex = 1 means sibling is left
        const left = pathIndex === 0 ? currentHash : pathElement;
        const right = pathIndex === 0 ? pathElement : currentHash;
        
        const result = poseidon([left, right]);
        currentHash = BigInt(poseidon.F.toString(result));
        
        console.log(`   Level ${i}: ${pathIndex === 0 ? 'L' : 'R'} -> ${currentHash.toString().substring(0, 20)}...`);
    }
    
    console.log("\n5. Final Verification:");
    console.log("   Computed root:", currentHash.toString());
    console.log("   Expected root:", merkleRoot);
    console.log("   Roots match:", currentHash.toString() === merkleRoot);
    
    // 4. Check problematic circuit logic
    console.log("\n6. Analyzing Circuit Logic Issues:");
    console.log("   The circuit has this logic:");
    console.log("   hashers[i].inputs[0] <== hashes[i] + path[i] * (0 - hashes[i]);");
    console.log("   hashers[i].inputs[1] <== hashes[i] + (1 - path[i]) * (0 - hashes[i]);");
    console.log("   ");
    console.log("   This simplifies to:");
    console.log("   - When path[i] = 0: inputs[0] = hashes[i], inputs[1] = 0");
    console.log("   - When path[i] = 1: inputs[0] = 0, inputs[1] = hashes[i]");
    console.log("   ");
    console.log("   This is WRONG! It should be:");
    console.log("   - When path[i] = 0: inputs[0] = hashes[i], inputs[1] = pathElement[i]");
    console.log("   - When path[i] = 1: inputs[0] = pathElement[i], inputs[1] = hashes[i]");
    
    return {
        commitmentMatch: calculatedCommitment === BigInt(targetCommitment).toString(),
        nullifierMatch: calculatedNullifier === BigInt(nullifier).toString(),
        merkleMatch: currentHash.toString() === merkleRoot,
        calculatedCommitment,
        calculatedNullifier,
        finalRoot: currentHash.toString()
    };
}

debugCircuitLogic().catch(console.error);
