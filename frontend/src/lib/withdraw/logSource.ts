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

type CacheEntry = {
  commitments: string[];
  lastBlock?: bigint;
};

export type LoadResult = {
  commitments: string[];
};

const defaultToBlock: BlockTag = "latest";

export function createDepositLogLoader() {
  const cache = new Map<string, CacheEntry>();

  return async function loadCommitments(options: LoadOptions): Promise<LoadResult> {
    const cacheKey = options.address.toLowerCase();
    const entry = cache.get(cacheKey);

    let fromBlock: BlockTag | undefined = options.fromBlock ?? "earliest";
    if (entry?.lastBlock !== undefined) {
      fromBlock = entry.lastBlock + 1n;
    }

    const logs = await options.publicClient.getLogs({
      address: options.address,
      event: options.event,
      fromBlock,
      toBlock: options.toBlock ?? defaultToBlock,
    });

    const newCommitments: string[] = [];
    let lastBlock = entry?.lastBlock;

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

    const commitments = entry
      ? entry.commitments.concat(newCommitments)
      : newCommitments;

    cache.set(cacheKey, { commitments, lastBlock });

    return { commitments };
  };
}

export function createResettableDepositLogLoader() {
  const loader = createDepositLogLoader();
  return {
    loadCommitments: loader,
  };
}
