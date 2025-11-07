export {};

declare global {
  interface Window {
    __e2e__?: {
      poolAddress?: string;
      autoConnect?: boolean;
      seedCommitments?: (params: {
        commitments: string[];
        lastBlock?: bigint | number | string;
        chainId?: number;
      }) => void;
      clearCommitments?: (chainId?: number) => void;
      mockWithdrawProof?: (mock: {
        proof: any;
        publicSignals: any[];
      } | null) => void;
      mockGenerateProof?: (note: string) => Promise<{
        proof: any;
        publicSignals: any[];
        cacheInfo?: {
          lastSyncedAt: number;
          expiresAt?: number;
          commitmentCount?: number;
        };
      } | null>;
      submitWithdrawalOverride?: (args: {
        proof: unknown;
        publicSignals: (string | bigint)[];
        recipient: `0x${string}`;
        fee: bigint;
        relayer: `0x${string}`;
        account?: `0x${string}`;
        chain?: unknown;
      }) => Promise<unknown> | unknown;
      lastSubmission?: unknown;
      lastSubmissionResult?: unknown;
      enableAutoConnect?: () => void;
      disableAutoConnect?: () => void;
      setPoolAddress?: (address: string) => void;
      forceConnected?: boolean;
      forceConnect?: () => void;
      clearForcedConnection?: () => void;
      connectionState?: {
        isConnected: boolean;
        chainId: number | null;
      };
      updateConnectionState?: (state: {
        isConnected: boolean;
        chainId: number | null;
      }) => void;
      mockAccount?: string;
      withdrawHydrated?: boolean;
    };
  }
}
