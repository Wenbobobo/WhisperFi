import { CacheEntry, PersistHandlers } from "./logSource";

const STORAGE_PREFIX = "whisperfi:commitments";

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function buildKey(chainId: number, addressKey: string) {
  return `${STORAGE_PREFIX}:${chainId}:${addressKey.toLowerCase()}`;
}

type PersistOptions = {
  chainId?: number;
  maxCommitments?: number;
  ttlMs?: number;
};

export function createLocalStoragePersistor(
  options: PersistOptions = {}
): PersistHandlers & { clearAll: () => void } {
  const chainId = options.chainId ?? 0;
  const limit = options.maxCommitments ?? 2048;
  const ttlMs = options.ttlMs;

  const load = (addressKey: string): CacheEntry | undefined => {
    if (!hasStorage()) return undefined;
    const storageKey = buildKey(chainId, addressKey);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as {
        commitments?: string[];
        lastBlock?: string;
        updatedAt?: number;
      };
      if (!Array.isArray(parsed.commitments)) {
        return undefined;
      }
      const normalized = parsed.commitments.slice(-limit);
      const lastBlock =
        typeof parsed.lastBlock === "string"
          ? BigInt(parsed.lastBlock)
          : undefined;

      if (ttlMs !== undefined) {
        if (!parsed.updatedAt || Date.now() - parsed.updatedAt > ttlMs) {
          window.localStorage.removeItem(storageKey);
          return undefined;
        }
        return {
          commitments: normalized,
          lastBlock,
          expiresAt: parsed.updatedAt + ttlMs,
          lastSyncedAt: parsed.updatedAt,
        };
      }
      return {
        commitments: normalized,
        lastBlock,
        lastSyncedAt: parsed.updatedAt,
      };
    } catch {
      return undefined;
    }
  };

  const save = (addressKey: string, entry: CacheEntry) => {
    if (!hasStorage()) return;
    const storageKey = buildKey(chainId, addressKey);
    const updatedAt = Date.now();
    const serialized = JSON.stringify({
      commitments: entry.commitments.slice(-limit),
      lastBlock:
        entry.lastBlock !== undefined ? entry.lastBlock.toString() : undefined,
      updatedAt,
    });
    window.localStorage.setItem(storageKey, serialized);
  };

  const clear = (addressKey: string) => {
    if (!hasStorage()) return;
    const storageKey = buildKey(chainId, addressKey);
    window.localStorage.removeItem(storageKey);
  };

  const clearAll = () => {
    if (!hasStorage()) return;
    const prefix = `${STORAGE_PREFIX}:${chainId}:`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  };

  return { load, save, clear, clearAll, ttlMs, chainId };
}
