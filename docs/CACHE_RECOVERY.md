# WhisperFi Cache Recovery Guide

This document describes the cache invalidation detection, recovery procedures, and user-facing error handling for the WhisperFi deposit log cache system.

## Table of Contents

- [Overview](#overview)
- [Cache Invalidation Detection](#cache-invalidation-detection)
- [Minimum Rebuild Procedure](#minimum-rebuild-procedure)
- [User-Facing Prompts](#user-facing-prompts)
- [Recovery Scenarios](#recovery-scenarios)
- [Best Practices](#best-practices)

## Overview

The WhisperFi frontend maintains a local cache of deposit commitments from the PrivacyPool contract. This cache enables fast Merkle proof generation without querying the blockchain repeatedly. However, under certain conditions, the cache may become invalid and require rebuilding.

## Cache Invalidation Detection

The cache is considered invalid when any of the following conditions are met:

### 1. TTL Expiration

**Condition**: The cache has exceeded its Time-To-Live (TTL) configured in `PersistHandlers.ttlMs`.

**Detection**:
```typescript
if (cached.expiresAt !== undefined && Date.now() > cached.expiresAt) {
  // Cache has expired
}
```

**Action**: Automatic cache eviction and rebuild on next access.

### 2. Merkle Root Mismatch

**Condition**: The locally computed Merkle root does not match the on-chain root.

**Detection**:
```typescript
const localRoot = tree.getRoot();
const onChainRoot = await privacyPool.merkleRoot();

if (localRoot !== onChainRoot) {
  // Cache is out of sync
}
```

**Action**: Clear cache and rebuild from blockchain events.

### 3. Missing Deposit Events

**Condition**: The cache is missing deposits that exist on-chain (detected by leaf index gaps).

**Detection**:
```typescript
const expectedCount = await privacyPool.nextLeafIndex();
const cachedCount = cache.commitments.length;

if (cachedCount < expectedCount) {
  // Missing commitments
}
```

**Action**: Incremental sync from `lastBlock + 1` to `latest`.

### 4. Chain Reorganization

**Condition**: The blockchain has undergone a reorganization affecting cached blocks.

**Detection**: Monitor `lastBlock` and compare with current chain state. If `lastBlock` references a block that no longer exists in the canonical chain, the cache is invalid.

**Action**: Full rebuild from `earliest` block.

### 5. Manual Cache Clear

**Condition**: User or application explicitly clears the cache via `clearCache()` or `clear()`.

**Detection**: Cache deletion event is triggered.

**Action**: Full rebuild on next access.

## Minimum Rebuild Procedure

When cache invalidation is detected, follow these steps for recovery:

### Step 1: Clear Corrupted Cache

```typescript
// For createResettableDepositLogLoader
await loader.clear(poolAddress);

// For createDepositLogLoader
loader.clearCache(poolAddress);
```

### Step 2: Rebuild from Blockchain Events

The rebuild process uses pagination and retry logic to handle large block ranges and RPC rate limits:

```typescript
const result = await loader.loadCommitments({
  publicClient,
  address: poolAddress,
  event: depositEvent,
  fromBlock: "earliest",
  toBlock: "latest",
  maxBlockRange: 10000,      // Fetch 10k blocks per request
  maxRetries: 4,             // Retry up to 4 times
  baseRetryDelayMs: 1000,    // Start with 1s delay
  maxRetryDelayMs: 16000,    // Cap delay at 16s
});
```

**Pagination**: Automatically splits large block ranges into chunks of `maxBlockRange` blocks.

**Retry Logic**: Implements exponential backoff (1s → 2s → 4s → 8s → 16s) for:
- Rate limit errors (429)
- Timeout errors (ETIMEDOUT)
- Network errors (ECONNRESET, NETWORK_ERROR)

### Step 3: Verify Merkle Root

After rebuilding, verify the computed Merkle root matches on-chain:

```typescript
import { CircuitCompatibleMerkleTree } from "../utils/crypto";

const tree = new CircuitCompatibleMerkleTree(16, result.commitments, ZERO_VALUE);
await tree.initialize();

const computedRoot = tree.getRoot();
const onChainRoot = await privacyPool.merkleRoot();

if (computedRoot !== onChainRoot) {
  throw new Error("Merkle root mismatch after rebuild");
}
```

### Step 4: Update Cache Status

Check cache status after rebuild:

```typescript
const status = loader.getCacheStatus(poolAddress);
console.log({
  lastBlock: status.lastBlock,
  commitmentCount: status.commitmentCount,
  lastSyncedAt: new Date(status.lastSyncedAt).toISOString(),
  expiresAt: status.expiresAt ? new Date(status.expiresAt).toISOString() : "never",
});
```

## User-Facing Prompts

### Error: Cache Expired

**Message**:
```
Your local deposit cache has expired and needs to be refreshed. This may take a moment while we sync with the blockchain.

[Refresh Cache]
```

**Technical Details**:
```
Cache expired at: {expiresAt}
Last synced: {lastSyncedAt}
Rebuilding from block {fromBlock} to {toBlock}...
```

### Error: Merkle Root Mismatch

**Message**:
```
The local Merkle tree is out of sync with the blockchain. Your deposit cache will be rebuilt automatically.

This can happen after:
- Network connectivity issues
- Blockchain reorganizations
- Long periods of inactivity

[Rebuild Cache]
```

**Technical Details**:
```
Expected root: {onChainRoot}
Computed root: {localRoot}
Clearing cache and rebuilding...
```

### Error: Rate Limit Exceeded

**Message**:
```
The blockchain RPC is currently rate-limited. Retrying automatically...

Attempt {attempt} of {maxRetries}
Waiting {delayMs}ms before retry
```

**Technical Details**:
```
Error: rate limit exceeded
Retry delay: {delayMs}ms (exponential backoff)
You can configure RPC retry settings in the application settings.
```

### Error: Network Timeout

**Message**:
```
Network timeout while fetching deposit events. Retrying automatically...

Attempt {attempt} of {maxRetries}
Next retry in {delayMs}ms
```

**Technical Details**:
```
Error: {error.message}
Block range: {fromBlock} to {toBlock}
If this persists, try:
- Reducing maxBlockRange in settings
- Using a different RPC endpoint
- Checking your internet connection
```

### Success: Cache Rebuilt

**Message**:
```
Deposit cache successfully rebuilt!

{commitmentCount} deposits loaded
Last synced at block {lastBlock}
```

## Recovery Scenarios

### Scenario 1: First-Time User

**Situation**: User has no cached data.

**Steps**:
1. Show loading indicator: "Loading deposit history..."
2. Fetch all deposits from `earliest` to `latest`
3. Build Merkle tree
4. Verify root matches on-chain
5. Cache results
6. Show success message

**Estimated Time**: 5-30 seconds (depends on deposit count and RPC speed)

### Scenario 2: Expired Cache

**Situation**: TTL has expired but cache is otherwise valid.

**Steps**:
1. Show prompt: "Cache expired, refreshing..."
2. Fetch new deposits from `lastBlock + 1` to `latest`
3. Append to existing cache
4. Rebuild Merkle tree
5. Verify root
6. Update cache with new TTL

**Estimated Time**: 1-5 seconds (incremental sync)

### Scenario 3: Merkle Root Mismatch

**Situation**: Computed root doesn't match on-chain (potential reorganization).

**Steps**:
1. Show warning: "Blockchain state mismatch detected"
2. Clear entire cache
3. Rebuild from `earliest`
4. Verify root multiple times
5. Update cache

**Estimated Time**: 10-30 seconds (full rebuild)

### Scenario 4: RPC Rate Limit

**Situation**: RPC provider is rate-limiting requests.

**Steps**:
1. Show status: "Rate limited, retrying..."
2. Apply exponential backoff (1s, 2s, 4s, 8s, 16s)
3. Continue pagination from last successful chunk
4. Complete rebuild
5. Verify and cache

**Estimated Time**: Variable (adds 1-30 seconds of delay)

### Scenario 5: Large Gap (Many Missed Deposits)

**Situation**: Cache is very outdated (e.g., 1000+ new deposits).

**Steps**:
1. Show progress bar: "Syncing deposits ({current}/{total})"
2. Use pagination to fetch in 10k block chunks
3. Update progress after each chunk
4. Build tree incrementally
5. Verify final root

**Estimated Time**: 30-120 seconds (depends on gap size)

## Best Practices

### For Users

1. **Stay Online**: Keep the application open to maintain cache freshness
2. **Regular Syncs**: Visit the application at least once per day to avoid large syncs
3. **Stable RPC**: Use reliable RPC providers to minimize rate limiting
4. **Clear Cache Sparingly**: Only clear cache when troubleshooting issues

### For Developers

1. **Reasonable TTLs**: Set TTL between 1-24 hours based on usage patterns
2. **Pagination**: Always use pagination for large block ranges (default: 10,000 blocks)
3. **Retry Logic**: Enable retry with exponential backoff for production
4. **Progress Indicators**: Show users rebuild progress for operations > 5 seconds
5. **Error Logging**: Log cache invalidation events for debugging
6. **Verification**: Always verify Merkle roots after rebuild
7. **Cross-Tab Sync**: Use `CacheSyncAdapter` to sync cache across browser tabs

### Configuration Examples

**Conservative (Slow RPC, High Reliability)**:
```typescript
{
  ttlMs: 3600000,           // 1 hour
  maxBlockRange: 5000,      // Small chunks
  maxRetries: 5,            // More retries
  baseRetryDelayMs: 2000,   // Longer delays
  maxRetryDelayMs: 32000,
}
```

**Aggressive (Fast RPC, Quick Syncs)**:
```typescript
{
  ttlMs: 600000,            // 10 minutes
  maxBlockRange: 50000,     // Large chunks
  maxRetries: 3,            // Fewer retries
  baseRetryDelayMs: 500,    // Shorter delays
  maxRetryDelayMs: 8000,
}
```

**Production Default (Balanced)**:
```typescript
{
  ttlMs: 1800000,           // 30 minutes
  maxBlockRange: 10000,     // 10k blocks
  maxRetries: 4,            // Moderate retries
  baseRetryDelayMs: 1000,   // 1s base delay
  maxRetryDelayMs: 16000,   // 16s max delay
}
```

## Troubleshooting

### Cache Never Rebuilds

**Cause**: TTL not configured or set too high.

**Fix**: Set `ttlMs` to a reasonable value (e.g., 1800000 for 30 minutes).

### Constant Merkle Root Mismatches

**Cause**: CircuitCompatibleMerkleTree implementation doesn't match on-chain logic.

**Fix**: Run `npx ts-node scripts/verify-merkle-consistency.ts` to identify discrepancies.

### Slow Rebuilds

**Cause**: RPC rate limiting or large block ranges.

**Fix**: Reduce `maxBlockRange` or switch to a faster RPC provider.

### Infinite Retry Loops

**Cause**: Non-retryable error being treated as retryable.

**Fix**: Check error detection logic in `retryWithBackoff()` function.

## Related Documentation

- [Merkle Consistency Verification](../scripts/verify-merkle-consistency.ts)
- [Log Source Implementation](../frontend/src/lib/withdraw/logSource.ts)
- [Log Source Tests](../frontend/src/lib/withdraw/logSource.test.ts)
- [Merkle Tree Implementation](../frontend/src/utils/crypto.ts)

## Support

For cache recovery issues, check:

1. Browser console for error messages
2. Network tab for RPC call failures
3. Cache status via `loader.getCacheStatus(address)`
4. On-chain state via `privacyPool.merkleRoot()` and `privacyPool.nextLeafIndex()`

If problems persist, clear browser storage and rebuild cache from scratch.
