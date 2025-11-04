const DEFAULT_CHANNEL = "whisperfi-commitment-cache";
const STORAGE_PREFIX = "whisperfi:commitment-sync";

export type CacheSyncAction = "refresh" | "clear";

export type CacheSyncPayload = {
  chainId: number;
  address: string;
  action: CacheSyncAction;
  updatedAt?: number;
};

export type CacheSyncEvent = CacheSyncPayload & {
  sourceId: string;
};

export type CacheSyncAdapter = {
  publish: (payload: CacheSyncPayload) => void;
  subscribe: (handler: (event: CacheSyncEvent) => void) => () => void;
  getSourceId: () => string;
};

function canUseWindow() {
  return typeof window !== "undefined";
}

function canUseStorage() {
  if (!canUseWindow()) {
    return false;
  }
  try {
    return !!window.localStorage;
  } catch {
    return false;
  }
}

function createSourceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function isCacheSyncEvent(value: any): value is CacheSyncEvent {
  return (
    value &&
    typeof value === "object" &&
    typeof value.address === "string" &&
    typeof value.chainId === "number" &&
    (value.action === "refresh" || value.action === "clear") &&
    typeof value.sourceId === "string"
  );
}

export function createCacheSync(channelName: string = DEFAULT_CHANNEL): CacheSyncAdapter {
  const listeners = new Set<(event: CacheSyncEvent) => void>();
  const sourceId = createSourceId();
  const storageKeyPrefix = `${STORAGE_PREFIX}:${channelName}`;

  const hasWindow = canUseWindow();
  const hasStorage = canUseStorage();

  let broadcastChannel: BroadcastChannel | undefined;

  if (hasWindow && typeof (window as any).BroadcastChannel === "function") {
    try {
      broadcastChannel = new BroadcastChannel(channelName);
      broadcastChannel.addEventListener("message", (event) => {
        if (isCacheSyncEvent(event.data)) {
          listeners.forEach((listener) => listener(event.data));
        }
      });
    } catch {
      broadcastChannel = undefined;
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || !event.newValue) return;
    if (!event.key.startsWith(storageKeyPrefix)) return;
    try {
      const parsed = JSON.parse(event.newValue);
      if (isCacheSyncEvent(parsed)) {
        listeners.forEach((listener) => listener(parsed));
      }
    } catch {
      // Ignore malformed payloads
    }
  };

  if (hasWindow) {
    window.addEventListener("storage", handleStorage);
  }

  const publish = (payload: CacheSyncPayload) => {
    const normalizedAddress = payload.address.toLowerCase();
    const message: CacheSyncEvent = {
      ...payload,
      address: normalizedAddress,
      updatedAt: payload.updatedAt ?? Date.now(),
      sourceId,
    };

    try {
      broadcastChannel?.postMessage(message);
    } catch {
      // ignore broadcast failures
    }

    if (hasStorage) {
      try {
        const key = `${storageKeyPrefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
        window.localStorage.setItem(key, JSON.stringify(message));
        window.localStorage.removeItem(key);
      } catch {
        // ignore storage fallback failures
      }
    }
  };

  const subscribe = (handler: (event: CacheSyncEvent) => void) => {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  };

  return {
    publish,
    subscribe,
    getSourceId: () => sourceId,
  };
}

const instances = new Map<string, CacheSyncAdapter>();

export function getCacheSync(channelName: string = DEFAULT_CHANNEL): CacheSyncAdapter {
  if (!instances.has(channelName)) {
    instances.set(channelName, createCacheSync(channelName));
  }
  return instances.get(channelName)!;
}
