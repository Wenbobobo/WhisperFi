// src/components/WithdrawCard.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  usePublicClient,
} from "wagmi";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";

import { CONTRACTS } from "../config/contracts";
import { isValidRecipientAddress } from "../utils/validation";
import { parseNote, generateCommitment, generateNullifierHash } from "../utils/crypto";
import { createWithdrawFlow } from "../lib/withdraw/flow";
import { createResettableDepositLogLoader } from "../lib/withdraw/logSource";
import { createLocalStoragePersistor } from "../lib/withdraw/localCache";
import { getCacheSync } from "../lib/withdraw/cacheSync";
import { buildWithdrawCircuitInputs } from "../lib/zk/builder";
import { generateWithdrawProof } from "../lib/zk/withdraw";
import { toWithdrawArgs } from "../lib/zk/submit";
import PrivacyPoolArtifact from "../abi/PrivacyPool.json";
import WithdrawForm from "./WithdrawForm";

const PRIVACY_POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS as `0x${string}`;
const PRIVACY_POOL_ADDRESS_KEY = PRIVACY_POOL_ADDRESS.toLowerCase();
const PrivacyPoolAbi = PrivacyPoolArtifact.abi;
const STEPS = ["Generate Proof", "Submit Transaction"];
const DEPOSIT_AMOUNT = ethers.parseEther("0.1");
const COMMITMENT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const E2E_CHAIN_ID_FALLBACK = 31337;
type CacheStatus = {
  lastSyncedAt: number;
  expiresAt?: number;
  commitmentCount: number;
};

const Spinner = () => (
  <svg
    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

export default function WithdrawCard() {
  const [note, setNote] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [isProving, setIsProving] = useState(false);
  const [proof, setProof] = useState<any>(null);
  const [publicSignals, setPublicSignals] = useState<any>(null);
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null);
  const [nullifierHash, setNullifierHash] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: string; message: string }>({
    type: "",
    message: "",
  });
  const [recipient, setRecipient] = useState<string>("");
  const [relayer, setRelayer] = useState<string>(ethers.ZeroAddress);
  const [feeInput, setFeeInput] = useState<string>("0");
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | undefined>();
  const [simulatedChainId, setSimulatedChainId] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const connection = window.__e2e__?.connectionState;
    if (typeof connection?.chainId === "number") {
      return connection.chainId;
    }
    if (window.__e2e__?.forceConnected) {
      return E2E_CHAIN_ID_FALLBACK;
    }
    return undefined;
  });
  const [simulatedAccount, setSimulatedAccount] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const candidate = window.__e2e__?.mockAccount;
    return typeof candidate === "string" ? candidate : undefined;
  });

  const { chain, address } = useAccount();
  const publicClient = usePublicClient();
  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.__e2e__ = window.__e2e__ || {};
    window.__e2e__.withdrawHydrated = true;
    try {
      window.dispatchEvent(new Event("e2e:withdraw-hydrated"));
    } catch {
      // ignore event dispatch failures in non-browser contexts
    }
    return () => {
      if (window.__e2e__) {
        window.__e2e__.withdrawHydrated = false;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyMockAccount = (value?: unknown) => {
      if (typeof value === "string") {
        setSimulatedAccount(value);
        return;
      }
      const candidate = window.__e2e__?.mockAccount;
      setSimulatedAccount(typeof candidate === "string" ? candidate : undefined);
    };
    applyMockAccount();
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      applyMockAccount(detail);
    };
    window.addEventListener("e2e:mock-account", handler);
    return () => {
      window.removeEventListener("e2e:mock-account", handler);
    };
  }, []);

  const cacheSync = useMemo(() => getCacheSync(), []);
  const activeAccount = address ?? simulatedAccount;
  const effectiveChainId = chain?.id ?? simulatedChainId ?? 0;

  const persistor = useMemo(
    () =>
      createLocalStoragePersistor({
        chainId: effectiveChainId,
        ttlMs: COMMITMENT_CACHE_TTL_MS,
      }),
    [effectiveChainId]
  );

  useEffect(() => {
    if (activeAccount && !recipient) {
      setRecipient(activeAccount);
    }
  }, [activeAccount, recipient]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      const connection = window.__e2e__?.connectionState;
      const mockAccount = window.__e2e__?.mockAccount;
      setSimulatedAccount(typeof mockAccount === "string" ? mockAccount : undefined);
      if (typeof connection?.chainId === "number") {
        setSimulatedChainId(connection.chainId);
        return;
      }
      if (window.__e2e__?.forceConnected) {
        setSimulatedChainId(E2E_CHAIN_ID_FALLBACK);
        return;
      }
      setSimulatedChainId(undefined);
    };
    handler();
    window.addEventListener("e2e:connection-state", handler as EventListener);
    return () => {
      window.removeEventListener("e2e:connection-state", handler as EventListener);
    };
  }, []);

  const cacheLoader = useMemo(
    () => createResettableDepositLogLoader(persistor, cacheSync),
    [persistor, cacheSync]
  );

  const loadCommitments = cacheLoader.loadCommitments;
  const clearCommitmentCache = cacheLoader.clear;
  const getCacheStatus = cacheLoader.getStatus;

  const readPersistedCacheStatus = useCallback((): CacheStatus | undefined => {
    if (!persistor?.load) return undefined;
    try {
      const entry = persistor.load(PRIVACY_POOL_ADDRESS_KEY);
      if (!entry || !entry.lastSyncedAt) {
        return undefined;
      }
      const commitmentCount =
        entry.commitmentCount ??
        (Array.isArray(entry.commitments) ? entry.commitments.length : 0);
      if (commitmentCount === 0) {
        return undefined;
      }
      return {
        lastSyncedAt: entry.lastSyncedAt,
        expiresAt: entry.expiresAt,
        commitmentCount,
      };
    } catch {
      return undefined;
    }
  }, [persistor]);

  useEffect(() => {
    if (!getCacheStatus) {
      setCacheStatus(readPersistedCacheStatus());
      return;
    }
    const status = getCacheStatus(PRIVACY_POOL_ADDRESS);
    if (status) {
      setCacheStatus({
        lastSyncedAt: status.lastSyncedAt,
        expiresAt: status.expiresAt,
        commitmentCount: status.commitmentCount,
      });
      return;
    }
    setCacheStatus(readPersistedCacheStatus());
  }, [getCacheStatus, effectiveChainId, readPersistedCacheStatus]);

  useEffect(() => {
    if (!getCacheStatus) return;
    const chainIdValue = effectiveChainId;
    const unsubscribe = cacheSync.subscribe((event) => {
      if (event.chainId !== chainIdValue) return;
      if (event.address !== PRIVACY_POOL_ADDRESS_KEY) return;
      if (event.action === "clear") {
        setCacheStatus(undefined);
        return;
      }
      if (event.action === "refresh") {
        const status = getCacheStatus(PRIVACY_POOL_ADDRESS);
        if (status) {
          setCacheStatus({
            lastSyncedAt: status.lastSyncedAt,
            expiresAt: status.expiresAt,
            commitmentCount: status.commitmentCount,
          });
          return;
        }
        setCacheStatus(readPersistedCacheStatus());
      }
    });
    return unsubscribe;
  }, [cacheSync, getCacheStatus, effectiveChainId, readPersistedCacheStatus]);

  const withdrawFlow = useMemo(() => {
    if (!publicClient) return null;

    return createWithdrawFlow({
      contractAddress: PRIVACY_POOL_ADDRESS,
      publicClient,
      parseNote,
      generateCommitment,
      generateNullifierHash,
      buildCircuitInputs: buildWithdrawCircuitInputs,
      generateWithdrawProof: (input) =>
        generateWithdrawProof(input as any, "/zk/withdraw.wasm", "/zk/withdraw.zkey"),
      toWithdrawArgs,
      withdrawAbi: PrivacyPoolAbi,
      depositAmountWei: DEPOSIT_AMOUNT,
      treeDepth: 16,
      fromBlock: "earliest",
      loadCommitments: (args) =>
        loadCommitments({
          ...args,
          publicClient,
        }),
      writeContract: async (config) => {
        const txHash = await writeContract({
          ...config,
          chain,
          account: activeAccount,
        } as any);
        return { hash: txHash as string };
      },
    });
  }, [publicClient, writeContract, chain, activeAccount, loadCommitments]);

  const generateProof = async (overrideNote?: string) => {
    if (!activeAccount || !withdrawFlow) {
      setFeedback({
        type: "error",
        message: "Please connect your wallet first.",
      });
      return;
    }

    const noteToUse = overrideNote ?? note;
    if (!noteToUse) {
      setFeedback({ type: "error", message: "Please enter your note." });
      return;
    }

    setIsProving(true);
    setActiveStep(0);
    setFeedback({
      type: "info",
      message: "Starting proof generation... this may take a moment.",
    });

    try {
      const mockGenerate = typeof window !== "undefined" ? window.__e2e__?.mockGenerateProof : undefined;
      setFeedback({
        type: "info",
        message: "Fetching deposit events to build Merkle tree...",
      });

      if (mockGenerate) {
        const mocked = await mockGenerate(noteToUse);
        if (mocked) {
          const { proof: mockedProof, publicSignals: mockedSignals, cacheInfo } = mocked;
          if (cacheInfo?.lastSyncedAt) {
            setCacheStatus({
              lastSyncedAt: cacheInfo.lastSyncedAt,
              expiresAt: cacheInfo.expiresAt,
              commitmentCount: cacheInfo.commitmentCount ?? 0,
            });
          }
          setProof(mockedProof);
          setPublicSignals(mockedSignals);
          setActiveStep(1);
          setFeedback({
            type: "success",
            message: "Proof generated successfully! You can now submit the withdrawal.",
          });
          return;
        }
      }

      const { proof: generatedProof, publicSignals: signals, merkle, nullifierHex, cacheInfo } =
        await withdrawFlow.generateProof(noteToUse);

      if (cacheInfo?.lastSyncedAt) {
        setCacheStatus((prev) => ({
          lastSyncedAt: cacheInfo.lastSyncedAt,
          expiresAt: cacheInfo.expiresAt,
          commitmentCount: cacheInfo.commitmentCount ?? prev?.commitmentCount ?? 0,
        }));
      }

      setProof(generatedProof);
      setPublicSignals(signals);
      setMerkleRoot(merkle?.root as string);
      setNullifierHash(nullifierHex as string);
      setActiveStep(1);
      setFeedback({
        type: "success",
        message: "Proof generated successfully! You can now submit the withdrawal.",
      });
    } catch (err) {
      let message =
        err instanceof Error ? err.message : "Proof generation failed. Please retry.";
      if (/commitment was not found/i.test(message) || /No deposit events found/i.test(message)) {
        message = `${message} Try resetting the commitment cache and generating the proof again.`;
      }
      setFeedback({ type: "error", message });
      setProof(null);
      setPublicSignals(null);
      setMerkleRoot(null);
      setNullifierHash(null);
    } finally {
      setIsProving(false);
    }
  };

  const handleWithdraw = async () => {
    const override =
      typeof window !== "undefined" ? window.__e2e__?.submitWithdrawalOverride : undefined;
    const hasChainContext = Boolean(chain) || Boolean(override);
    if (!proof || !publicSignals || !activeAccount || !withdrawFlow || !hasChainContext) {
      setFeedback({
        type: "error",
        message: "Proof, public signals, or wallet connection is missing.",
      });
      return;
    }

    if (!isValidRecipientAddress(recipient)) {
      setFeedback({
        type: "error",
        message: "Recipient address is invalid.",
      });
      return;
    }

    if (!isValidRecipientAddress(relayer)) {
      setFeedback({
        type: "error",
        message: "Relayer address is invalid.",
      });
      return;
    }

    let feeWei: bigint;
    try {
      const trimmed = feeInput.trim();
      feeWei =
        trimmed.length === 0
          ? 0n
          : ethers.parseEther(trimmed);
      if (feeWei < 0n) {
        throw new Error("Fee must be non-negative.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to parse relayer fee.";
      setFeedback({ type: "error", message });
      return;
    }

    try {
      const submission = {
        proof,
        publicSignals,
        recipient: recipient as `0x${string}`,
        fee: feeWei,
        relayer: relayer as `0x${string}`,
        account: activeAccount as `0x${string}`,
        chain: chain ?? ({ id: simulatedChainId ?? E2E_CHAIN_ID_FALLBACK } as typeof chain),
        merkleRoot,
        nullifierHash,
      };

      if (override) {
        const result = await override(submission);
        if (typeof window !== "undefined") {
          window.__e2e__ = window.__e2e__ || {};
          window.__e2e__.lastSubmission = submission;
          window.__e2e__.lastSubmissionResult = result;
        }
      } else {
        await withdrawFlow.submitWithdrawal(submission);
      }
      setActiveStep(1);
      setFeedback({
        type: "info",
        message: "Please confirm the transaction in your wallet.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Submit failed, please try again.",
      });
    }
  };

  const handleComplianceReport = () => setIsComplianceModalOpen(true);
  const closeComplianceModal = () => setIsComplianceModalOpen(false);

  const handleResetCache = async () => {
    try {
      setIsClearingCache(true);
      await clearCommitmentCache?.(PRIVACY_POOL_ADDRESS);
      setProof(null);
      setPublicSignals(null);
      setMerkleRoot(null);
      setNullifierHash(null);
      setActiveStep(0);
      setFeedback({
        type: "success",
        message: "Commitment cache cleared. Please generate the proof again.",
      });
      setCacheStatus(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clear commitment cache.";
      setFeedback({ type: "error", message });
    } finally {
      setIsClearingCache(false);
    }
  };

  const finalError = writeError || receiptError;

  return (
    <motion.div
      className="bg-gray-800 border border-gray-700 rounded-lg p-6 sm:p-8 max-w-md mx-auto mt-10 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Withdraw Funds</h2>
        <p className="text-gray-400 mt-2">
          Enter your private note to withdraw your deposited funds.
        </p>
      </div>

      <div className="mt-6">
        <div className="flex justify-between mb-4">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={`flex-1 text-center ${
                index <= activeStep ? "text-blue-400" : "text-gray-500"
              }`}
            >
              <div
                className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center border-2 ${
                  index <= activeStep
                    ? "bg-blue-600 border-blue-400"
                    : "border-gray-500"
                }`}
              >
                {index < activeStep ? "✔" : index + 1}
              </div>
              <p className="text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <WithdrawForm
            onGenerateProof={async (incomingNote: string) => {
              setNote(incomingNote);
              await generateProof(incomingNote);
            }}
            onSubmit={async () => handleWithdraw()}
            loading={isProving || isConfirming}
            disabled={isPending || isConfirming}
            note={note}
            onNoteChange={setNote}
            recipient={recipient}
            onRecipientChange={setRecipient}
            relayer={relayer}
            onRelayerChange={setRelayer}
            fee={feeInput}
            onFeeChange={setFeeInput}
          />

          <button
            onClick={handleComplianceReport}
            disabled={isProving || isPending || isConfirming}
            className="w-full flex items-center justify-center bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100"
          >
            Generate Compliance Report
          </button>
          <button
            onClick={handleResetCache}
            disabled={isProving || isPending || isConfirming || isClearingCache}
            className="w-full flex items-center justify-center bg-gray-700 hover:bg-gray-800 disabled:bg-gray-500 text-white font-bold py-2.5 px-4 rounded-lg transition-all duration-300 ease-in-out"
          >
            {isClearingCache ? "Clearing Cache..." : "Reset Commitment Cache"}
          </button>
        </div>

        {cacheStatus && (
          <div className="mt-4 bg-gray-900/40 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 space-y-1">
            <p>
              Cache last synced at{" "}
              {new Date(cacheStatus.lastSyncedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {cacheStatus.expiresAt && (
              <p>
                Expires around{" "}
                {new Date(cacheStatus.expiresAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            <p>{cacheStatus.commitmentCount} commitments cached</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(feedback.message || finalError || isConfirmed) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-4 p-3 rounded-lg text-sm ${
              feedback.type === "error" || finalError
                ? "bg-red-900/50 border border-red-700 text-red-300"
                : feedback.type === "success" || isConfirmed
                ? "bg-green-900/50 border border-green-700 text-green-300"
                : "bg-blue-900/50 border border-blue-700 text-blue-300"
            }`}
          >
            {finalError ? (
              `Error: ${finalError.message}`
            ) : isConfirmed ? (
              <>
                Withdrawal successful!
                <a
                  href={`${chain?.blockExplorers?.default.url}/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline ml-1"
                >
                  View on Explorer
                </a>
              </>
            ) : (
              <>
                {feedback.type === "info" && (
                  <span className="inline-flex items-center">
                    <Spinner />
                    {feedback.message}
                  </span>
                )}
                {feedback.type !== "info" && feedback.message}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isComplianceModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={closeComplianceModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-4">
                  Compliance Report Generation
                </h3>
                <div className="text-gray-300 text-sm space-y-3 mb-6">
                  <p>
                    This feature allows you to generate a cryptographic report to prove
                    the origin of your funds.
                  </p>
                  <p>It is currently under development and will be available soon.</p>
                </div>
                <button
                  onClick={closeComplianceModal}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
