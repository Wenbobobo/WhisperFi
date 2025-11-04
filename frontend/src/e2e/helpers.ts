const CHAIN_ID = 31337;

export type SeedCommitmentsParams = {
  commitments: string[];
  lastBlock?: bigint | number | string;
  chainId?: number;
};

export type MockProof = {
  proof: any;
  publicSignals: any[];
};

const globalAny: any = typeof window !== "undefined" ? window : {};

const ensureNamespace = () => {
  if (!globalAny.__e2e__) {
    globalAny.__e2e__ = {};
  }
};

if (typeof window !== "undefined") {
  ensureNamespace();

  if (typeof globalAny.__e2e__.forceConnected === "undefined") {
    globalAny.__e2e__.forceConnected = false;
  }

  globalAny.__e2e__.seedCommitments = ({ commitments, lastBlock, chainId }: SeedCommitmentsParams) => {
    const resolvedChainId = chainId ?? CHAIN_ID;
    const poolAddress = (globalAny.__e2e__?.poolAddress ?? '').toLowerCase();
    if (!poolAddress) {
      throw new Error("__e2e__.poolAddress is not set");
    }
    const key = `whisperfi:commitments:${resolvedChainId}:${poolAddress}`;
    const payload = {
      commitments,
      lastBlock: lastBlock !== undefined ? lastBlock.toString() : undefined,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
    window.localStorage.setItem(
      `whisperfi:commitment-sync:whisperfi-commitment-cache:${Date.now()}`,
      JSON.stringify({
        chainId: resolvedChainId,
        address: poolAddress,
        action: "refresh",
        updatedAt: payload.updatedAt,
        sourceId: "e2e-seed",
      })
    );
  };

  globalAny.__e2e__.setPoolAddress = (address: string) => {
    ensureNamespace();
    globalAny.__e2e__.poolAddress = address;
  };

  globalAny.__e2e__.mockWithdrawProof = (mock: MockProof | null) => {
    ensureNamespace();
    globalAny.__e2e__.mockProof = mock;
  };

  globalAny.__e2e__.enableAutoConnect = () => {
    ensureNamespace();
    globalAny.__e2e__.autoConnect = true;
    globalAny.__e2e__.forceConnected = true;
  };

  globalAny.__e2e__.disableAutoConnect = () => {
    ensureNamespace();
    globalAny.__e2e__.autoConnect = false;
    globalAny.__e2e__.forceConnected = false;
  };

  globalAny.__e2e__.forceConnect = () => {
    ensureNamespace();
    globalAny.__e2e__.forceConnected = true;
  };

  globalAny.__e2e__.clearForcedConnection = () => {
    ensureNamespace();
    globalAny.__e2e__.forceConnected = false;
  };
}

export const getMockedProof = (): MockProof | null => {
  if (typeof window === "undefined") return null;
  return window.__e2e__?.mockProof ?? null;
};
