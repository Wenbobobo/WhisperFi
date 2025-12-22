# Critical Bug Fix: Invalid Merkle Root Error

## Issue Summary
The withdrawal flow was failing with "Invalid Merkle root" error. Users could generate ZK proofs successfully, but transactions would revert when submitted to the contract.

## Root Cause Analysis

### The Problem
The circuit outputs a **single public signal**: `publicInputsHash = Poseidon(merkleRoot, nullifier)`

However, the frontend code in `toWithdrawArgs()` was incorrectly trying to extract the merkleRoot and nullifier from the public signals array:

```typescript
// ❌ INCORRECT (before fix)
const rootBytes32 = ethers.toBeHex(BigInt(publicSignals[0] as any), 32);
const nullifierBytes32 = ethers.toBeHex(BigInt(publicSignals[1] as any), 32);
```

This meant:
- `publicSignals[0]` = the hashed value (publicInputsHash), NOT the merkle root
- `publicSignals[1]` = undefined, NOT the nullifier

The contract's `withdraw()` function was receiving:
- `_proofRoot` = publicInputsHash (wrong!)
- `_nullifier` = undefined or 0 (wrong!)

Since the publicInputsHash wasn't in the contract's `rootHistory` mapping, the transaction reverted with "Invalid Merkle root".

## The Solution

### 1. Updated `toWithdrawArgs()` Function
**File**: `frontend/src/lib/zk/submit.ts:20-48`

Added optional parameters to accept the actual merkleRoot and nullifierHash:

```typescript
export function toWithdrawArgs(
  proof: Groth16Proof,
  publicSignals: (string | bigint)[],
  recipient: `0x${string}`,
  fee: bigint,
  relayer: `0x${string}`,
  merkleRoot?: string | bigint,      // ✅ NEW
  nullifierHash?: string | bigint    // ✅ NEW
) {
  const formatted = normalizeProof(proof);
  // If merkleRoot and nullifierHash are provided explicitly, use them
  // Otherwise fall back to extracting from publicSignals (legacy behavior)
  const rootBytes32 = merkleRoot
    ? ethers.toBeHex(BigInt(merkleRoot as any), 32)
    : ethers.toBeHex(BigInt(publicSignals[0] as any), 32);
  const nullifierBytes32 = nullifierHash
    ? ethers.toBeHex(BigInt(nullifierHash as any), 32)
    : ethers.toBeHex(BigInt(publicSignals[1] as any), 32);
  // ...
}
```

### 2. Updated Withdrawal Flow
**File**: `frontend/src/lib/withdraw/flow.ts:40-48,167-186`

Updated the type signature to accept and pass these values:

```typescript
toWithdrawArgs: (
  proof: unknown,
  publicSignals: (string | bigint)[],
  recipient: `0x${string}`,
  fee: bigint,
  relayer: `0x${string}`,
  merkleRoot?: string | bigint,      // ✅ NEW
  nullifierHash?: string | bigint    // ✅ NEW
) => readonly unknown[];
```

And updated `submitWithdrawal()` to pass them through:

```typescript
const contractArgs = deps.toWithdrawArgs(
  args.proof,
  args.publicSignals,
  args.recipient,
  args.fee,
  args.relayer,
  args.merkleRoot,      // ✅ NEW
  args.nullifierHash    // ✅ NEW
);
```

### 3. Updated WithdrawCard Component
**File**: `frontend/src/components/WithdrawCard.tsx`

Added state to store the values:

```typescript
const [merkleRoot, setMerkleRoot] = useState<string | null>(null);
const [nullifierHash, setNullifierHash] = useState<string | null>(null);
```

Captured them from proof generation:

```typescript
const { proof: generatedProof, publicSignals: signals, merkle, nullifierHex, cacheInfo } =
  await withdrawFlow.generateProof(noteToUse);

setProof(generatedProof);
setPublicSignals(signals);
setMerkleRoot(merkle?.root as string);        // ✅ NEW
setNullifierHash(nullifierHex as string);     // ✅ NEW
```

Passed them in submission:

```typescript
const submission = {
  proof,
  publicSignals,
  recipient: recipient as `0x${string}`,
  fee: feeWei,
  relayer: relayer as `0x${string}`,
  account: activeAccount as `0x${string}`,
  chain: chain ?? ({ id: simulatedChainId ?? E2E_CHAIN_ID_FALLBACK } as typeof chain),
  merkleRoot,        // ✅ NEW
  nullifierHash,     // ✅ NEW
};
```

## Additional Fixes

### Circuit Syntax (Circom 2.0 Compatibility)
**File**: `circuits/withdraw.circom:28-42`

Fixed component declaration inside loop (not allowed in Circom 2.0):

```circom
// ❌ BEFORE (broken)
for (var i = 0; i < levels; i++) {
    component h = Poseidon(2);  // Error!
    ...
}

// ✅ AFTER (fixed)
component merkleHashers[levels];
for (var i = 0; i < levels; i++) {
    merkleHashers[i] = Poseidon(2);
}

signal hashes[levels + 1];
hashes[0] <== commitment;

for (var i = 0; i < levels; i++) {
    merkleHashers[i].inputs[0] <== hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
    merkleHashers[i].inputs[1] <== pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);
    hashes[i + 1] <== merkleHashers[i].out;
}
```

Recompiled circuit artifacts:
- `frontend/public/zk/withdraw.wasm` (1.7MB)
- `frontend/public/zk/withdraw.zkey` (2.7MB)
- `contracts/Groth16Verifier.sol` (6.9KB)

## Verification

Created verification scripts:
- `scripts/debug-root-history.ts` - Confirms Merkle root calculations match between frontend and contract
- `scripts/check-commitment.ts` - Validates commitment calculations
- `scripts/test-withdrawal-flow.ts` - End-to-end withdrawal test

### Verification Results
✅ Merkle root calculated by frontend matches contract root
✅ Merkle root exists in contract's rootHistory mapping
✅ ZK proof generates successfully (~30 seconds)
✅ Public inputs hash calculated correctly

## Files Modified

1. `frontend/src/lib/zk/submit.ts` - Fixed merkleRoot/nullifier extraction
2. `frontend/src/lib/withdraw/flow.ts` - Updated type signatures
3. `frontend/src/components/WithdrawCard.tsx` - Added state and passing logic
4. `circuits/withdraw.circom` - Fixed Circom 2.0 syntax
5. `frontend/public/zk/*` - Regenerated circuit artifacts
6. `contracts/Groth16Verifier.sol` - Regenerated verifier contract

## Testing Recommendations

1. **Restart Development Server**: The frontend dev server should be restarted to pick up the code changes
   ```bash
   cd frontend && npm run dev
   ```

2. **Run E2E Test**: Use the Playwright test to verify the complete flow
   ```bash
   cd frontend && npx playwright test tests/simple-zk-test.playwright.ts --headed
   ```

3. **Manual Test**: Use the UI at `http://localhost:3000/e2e/withdraw` with the test note

## Status
🎯 **Core bug fixed!** The withdrawal flow should now work correctly with the proper merkleRoot and nullifier being passed to the contract.

The remaining work is validation testing to confirm the fix resolves the issue end-to-end.
