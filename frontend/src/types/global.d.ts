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
      mockWithdrawProof?: (mock: {
        proof: any;
        publicSignals: any[];
      } | null) => void;
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
    };
  }
}
