import { CONTRACTS } from "../../config/contracts";
import { getMockedProof } from "../../e2e/helpers";
import { createDepositLogLoader } from "./logSource";

type PublicClient = {
  getLogs: (args: {
    address: string;
    event: {
      type: "event";
      name: string;
      inputs: Array<{ type: string; name: string; indexed?: boolean }>;
    };
    fromBlock?: bigint | number | string;
    toBlock?: bigint | number | string;
  }) => Promise<Array<{ args: { commitment?: string } }>>;
};

type WithdrawFlowDeps = {
  contractAddress?: string;
  publicClient: PublicClient;
  parseNote: (note: string) => { secret: string; nullifier: string };
  generateCommitment: (secret: string, amountWei: string) => Promise<string>;
  generateNullifierHash: (secret: string) => Promise<string>;
  buildCircuitInputs: (
    secretHex: string,
    amountWei: string,
    commitments: string[],
    leafIndex: number,
    zeroValue: string,
    depth: number
  ) => Promise<{
    input: unknown;
    merkle: { root: string };
    nullifierHex: string;
  }>;
  generateWithdrawProof: (input: unknown) => Promise<{
    proof: unknown;
    publicSignals: (string | bigint)[];
  }>;
  toWithdrawArgs: (
    proof: unknown,
    publicSignals: (string | bigint)[],
    recipient: `0x${string}`,
    fee: bigint,
    relayer: `0x${string}`
  ) => readonly unknown[];
  writeContract: (config: {
    address: string;
    abi: any;
    functionName: string;
    args: readonly unknown[];
    account?: `0x${string}`;
    chain?: unknown;
  }) => Promise<{ hash: string }>;
  depositAmountWei?: bigint;
  zeroValueHex?: string;
  treeDepth?: number;
  fromBlock?: bigint | number | string;
  withdrawAbi?: any;
  loadCommitments?: (args: {
    publicClient: PublicClient;
    address: string;
    event: {
      type: "event";
      name: string;
      inputs: Array<{ type: string; name: string; indexed?: boolean }>;
    };
    fromBlock?: bigint | number | string;
  }) => Promise<{
    commitments: string[];
    lastBlock?: bigint;
    lastSyncedAt?: number;
    expiresAt?: number;
    commitmentCount: number;
  }>;
};

const DEFAULT_DEPOSIT = BigInt("100000000000000000"); // 0.1 ETH
const DEFAULT_ZERO =
  "5738151709701895985996174429509233181681189240650583716378205449277091542814";
const DEFAULT_TREE_DEPTH = 16;

const defaultDepositLoader = createDepositLogLoader();

export function createWithdrawFlow(deps: WithdrawFlowDeps) {
  const contractAddress =
    deps.contractAddress ?? CONTRACTS.PRIVACY_POOL_ADDRESS;
  const depositAmount = deps.depositAmountWei ?? DEFAULT_DEPOSIT;
  const zeroValue = deps.zeroValueHex ?? DEFAULT_ZERO;
  const treeDepth = deps.treeDepth ?? DEFAULT_TREE_DEPTH;

  const depositEvent = {
    type: "event" as const,
    name: "Deposit",
    inputs: [
      { type: "bytes32", name: "commitment", indexed: true },
      { type: "uint32", name: "leafIndex", indexed: false },
      { type: "uint256", name: "timestamp", indexed: false },
    ],
  };

  async function generateProof(note: string) {
    const { secret } = deps.parseNote(note);
    const commitment = await deps.generateCommitment(
      secret,
      depositAmount.toString()
    );
    await deps.generateNullifierHash(secret);

    const loader = deps.loadCommitments ?? defaultDepositLoader;
    const {
      commitments,
      lastSyncedAt,
      expiresAt,
      commitmentCount,
    } = await loader({
      publicClient: deps.publicClient,
      address: contractAddress,
      event: depositEvent,
      fromBlock: deps.fromBlock,
    });

    if (commitments.length === 0) {
      throw new Error("No deposit events found. The pool is empty.");
    }

    const leafIndex = commitments.findIndex((item) => item === commitment);
    if (leafIndex < 0) {
      throw new Error(
        "Your deposit commitment was not found in the Merkle tree."
      );
    }

    const { input, merkle, nullifierHex } = await deps.buildCircuitInputs(
      secret,
      depositAmount.toString(),
      commitments,
      leafIndex,
      zeroValue,
      treeDepth
    );

    const mocked = getMockedProof();
    const { proof, publicSignals } = mocked
      ? mocked
      : await deps.generateWithdrawProof(input);

    return {
      proof,
      publicSignals,
      merkle,
      nullifierHex,
      commitment,
      leafIndex,
      cacheInfo: lastSyncedAt
        ? {
            lastSyncedAt,
            expiresAt,
            commitmentCount: commitmentCount ?? commitments.length,
          }
        : undefined,
    };
  }

  async function submitWithdrawal(args: {
    proof: unknown;
    publicSignals: (string | bigint)[];
    recipient: `0x${string}`;
    fee: bigint;
    relayer: `0x${string}`;
    account?: `0x${string}`;
    chain?: unknown;
  }) {
    const contractArgs = deps.toWithdrawArgs(
      args.proof,
      args.publicSignals,
      args.recipient,
      args.fee,
      args.relayer
    );

    return deps.writeContract({
      address: contractAddress,
      abi:
        deps.withdrawAbi ??
        ["function withdraw(uint[2],uint[2][2],uint[2],bytes32,bytes32,address,uint256,address)"],
      functionName: "withdraw",
      args: contractArgs,
      account: args.account,
      chain: args.chain,
    });
  }

  return {
    generateProof,
    submitWithdrawal,
  };
}
