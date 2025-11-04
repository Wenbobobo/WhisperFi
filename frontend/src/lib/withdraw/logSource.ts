import type { CacheSyncAdapter } from "./cacheSync";

type BlockTag = bigint | number | string;

type PublicClient = {
  getLogs: (args: {
    address: string;
    event: {
      type: "event";
      name: string;
      inputs: Array<{ type: string; name: string; indexed?: boolean }>;
    };
    fromBlock?: BlockTag;
    toBlock?: BlockTag;
  }) => Promise<Array<{ args: { commitment?: string }; blockNumber?: bigint }>>;
};

type LoadOptions = {
  publicClient: PublicClient;
  address: string;
  event: {
    type: "event";
    name: string;
    inputs: Array<{ type: string; name: string; indexed?: boolean }>;
  };
  fromBlock?: BlockTag;
  toBlock?: BlockTag;
};

export type CacheEntry = {
  commitments: string[];
  lastBlock?: bigint;
  expiresAt?: number;
  lastSyncedAt?: number;
  commitmentCount?: number;
};

export type PersistHandlers = {
  load?: (key: string) => Promise<CacheEntry | undefined> | CacheEntry | undefined;
  save?: (key: string, entry: CacheEntry) => Promise<void> | void;
  clear?: (key: string) => Promise<void> | void;
  clearAll?: () => Promise<void> | void;
  ttlMs?: number;
  chainId?: number;
};

export type LoadResult = {
  commitments: string[];
  lastBlock?: bigint;
  lastSyncedAt?: number;
  expiresAt?: number;
  commitmentCount: number;
};

const defaultToBlock: BlockTag = "latest";

type DepositLoader = ((options: LoadOptions) => Promise<LoadResult>) & {
  clearCache: (key: string) => void;
  clearAll: () => void;
  getCacheStatus: (key: string) => {
    lastBlock?: bigint;
    lastSyncedAt: number;
    expiresAt?: number;
    commitmentCount: number;
  } | undefined;
};

export function createDepositLogLoader(persist?: PersistHandlers, sync?: CacheSyncAdapter): DepositLoader {
  const cache = new Map<string, CacheEntry>();
  const chainId = persist?.chainId ?? 0;

  function normalizeKey(key: string) {
    return key.toLowerCase();
  }

  function normalizeEntry(entry: CacheEntry): CacheEntry {
    const normalized: CacheEntry = {
      commitments: [...entry.commitments],
      lastBlock: entry.lastBlock,
    };
    const ttlMs = persist?.ttlMs;
    const expiresAt =
      entry.expiresAt ?? (ttlMs !== undefined ? Date.now() + ttlMs : undefined);
    if (expiresAt !== undefined) {
      normalized.expiresAt = expiresAt;
    }
    const lastSyncedAt = entry.lastSyncedAt ?? Date.now();
    normalized.lastSyncedAt = lastSyncedAt;
    normalized.commitmentCount = entry.commitmentCount ?? normalized.commitments.length;
    return normalized;
  }

  if (sync) {
    sync.subscribe((event) => {
      if (event.chainId !== chainId) return;
      const cacheKey = normalizeKey(event.address);
      if (event.action === "clear") {
        cache.delete(cacheKey);
        if (persist?.clear) {
          try {
            const result = persist.clear(cacheKey);
            if (result instanceof Promise) {
              result.catch(() => {});
            }
          } catch {
            // ignore persistence clear failures from remote tabs
          }
        }
      } else if (event.action === "refresh") {
        cache.delete(cacheKey);
      }
    });
  }

  async function readEntry(key: string): Promise<CacheEntry | undefined> {
    const cached = cache.get(key);
    if (cached) {
      if (cached.expiresAt !== undefined && Date.now() > cached.expiresAt) {
        cache.delete(key);
        if (persist?.clear) {
          await persist.clear(key);
        }
        sync?.publish({
          chainId,
          address: key,
          action: "clear",
          updatedAt: Date.now(),
        });
      } else {
        return cached;
      }
    }

    if (persist?.load) {
      const persisted = await persist.load(key);
      if (persisted) {
        const normalized = normalizeEntry(persisted);
        cache.set(key, normalized);
        return normalized;
      }
    }

    return undefined;
  }

  async function storeEntry(key: string, entry: CacheEntry) {
    const normalized = normalizeEntry(entry);
    cache.set(key, normalized);
    if (persist?.save) {
      await persist.save(key, normalized);
    }
  }

  const loadCommitments = async function (options: LoadOptions): Promise<LoadResult> {
    const cacheKey = normalizeKey(options.address);
    const existing = await readEntry(cacheKey);

    let fromBlock: BlockTag | undefined = options.fromBlock ?? "earliest";
    if (existing?.lastBlock !== undefined) {
      fromBlock = existing.lastBlock + 1n;
    }

    const logs = await options.publicClient.getLogs({
      address: options.address,
      event: options.event,
      fromBlock,
      toBlock: options.toBlock ?? defaultToBlock,
    });

    const newCommitments: string[] = [];
    let lastBlock = existing?.lastBlock;

    for (const log of logs) {
      const commitment = log.args.commitment;
      if (commitment) {
        newCommitments.push(commitment);
      }
      if (typeof log.blockNumber === "bigint") {
        if (!lastBlock || log.blockNumber > lastBlock) {
          lastBlock = log.blockNumber;
        }
      }
    }

    const mergedCommitments = existing
      ? existing.commitments.concat(newCommitments)
      : newCommitments;

    const updatedEntry: CacheEntry = {
      commitments: mergedCommitments,
      lastBlock,
      lastSyncedAt: Date.now(),
      commitmentCount: mergedCommitments.length,
    };

    await storeEntry(cacheKey, updatedEntry);

    const finalEntry = cache.get(cacheKey) ?? updatedEntry;
    if (sync) {
      const shouldBroadcast =
        newCommitments.length > 0 || !existing;
      if (shouldBroadcast) {
        sync.publish({
          chainId,
          address: cacheKey,
          action: "refresh",
          updatedAt: finalEntry?.lastSyncedAt,
        });
      }
    }

    return {
      commitments: mergedCommitments,
      lastBlock: finalEntry?.lastBlock,
      lastSyncedAt: finalEntry?.lastSyncedAt,
      expiresAt: finalEntry?.expiresAt,
      commitmentCount: mergedCommitments.length,
    };
  } as DepositLoader;

  loadCommitments.clearCache = (address: string) => {
    const cacheKey = normalizeKey(address);
    cache.delete(cacheKey);
    if (sync) {
      sync.publish({
        chainId,
        address: cacheKey,
        action: "clear",
        updatedAt: Date.now(),
      });
    }
  };

  loadCommitments.clearAll = () => {
    cache.clear();
  };

  loadCommitments.getCacheStatus = (address: string) => {
    const cacheKey = normalizeKey(address);
    const entry = cache.get(cacheKey);
    if (!entry) return undefined;
    if (
      entry.expiresAt !== undefined &&
      entry.expiresAt <= Date.now()
    ) {
      cache.delete(cacheKey);
      return undefined;
    }
    if (entry.lastSyncedAt === undefined) return undefined;
    return {
      lastBlock: entry.lastBlock,
      lastSyncedAt: entry.lastSyncedAt,
      expiresAt: entry.expiresAt,
      commitmentCount: entry.commitmentCount ?? entry.commitments.length,
    };
  };

  return loadCommitments;
}

export function createResettableDepositLogLoader(persist?: PersistHandlers, sync?: CacheSyncAdapter) {
  const loader = createDepositLogLoader(persist, sync);
  return {
    loadCommitments: loader,
    clear: async (address: string) => {
      loader.clearCache(address);
      if (persist?.clear) {
        await persist.clear(address.toLowerCase());
      }
    },
    getStatus: (address: string) => loader.getCacheStatus(address),
  };
}
