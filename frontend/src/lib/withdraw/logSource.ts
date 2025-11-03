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
};

export type PersistHandlers = {
  load?: (key: string) => Promise<CacheEntry | undefined> | CacheEntry | undefined;
  save?: (key: string, entry: CacheEntry) => Promise<void> | void;
  clear?: (key: string) => Promise<void> | void;
};

export type LoadResult = {
  commitments: string[];
};

const defaultToBlock: BlockTag = "latest";

export function createDepositLogLoader(persist?: PersistHandlers) {
  const cache = new Map<string, CacheEntry>();

  async function readEntry(key: string): Promise<CacheEntry | undefined> {
    if (cache.has(key)) {
      return cache.get(key);
    }

    if (persist?.load) {
      const persisted = await persist.load(key);
      if (persisted) {
        cache.set(key, {
          commitments: [...persisted.commitments],
          lastBlock: persisted.lastBlock,
        });
        return cache.get(key);
      }
    }

    return undefined;
  }

  async function storeEntry(key: string, entry: CacheEntry) {
    cache.set(key, entry);
    if (persist?.save) {
      await persist.save(key, entry);
    }
  }

  return async function loadCommitments(options: LoadOptions): Promise<LoadResult> {
    const cacheKey = options.address.toLowerCase();
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
    };

    await storeEntry(cacheKey, updatedEntry);

    return { commitments: mergedCommitments };
  };
}

export function createResettableDepositLogLoader(persist?: PersistHandlers) {
  const loader = createDepositLogLoader(persist);
  return {
    loadCommitments: loader,
    clear: async (address: string) => {
      if (persist?.clear) {
        await persist.clear(address.toLowerCase());
      }
    },
  };
}
