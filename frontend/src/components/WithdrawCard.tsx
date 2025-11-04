// src/components/WithdrawCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const [feedback, setFeedback] = useState<{ type: string; message: string }>({
    type: "",
    message: "",
  });
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | undefined>();

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

  const cacheSync = useMemo(() => getCacheSync(), []);

  const cacheLoader = useMemo(() => {
    const persistor = createLocalStoragePersistor({
      chainId: chain?.id ?? 0,
      ttlMs: COMMITMENT_CACHE_TTL_MS,
    });
    return createResettableDepositLogLoader(persistor, cacheSync);
  }, [chain?.id, cacheSync]);

  const loadCommitments = cacheLoader.loadCommitments;
  const clearCommitmentCache = cacheLoader.clear;
  const getCacheStatus = cacheLoader.getStatus;

  useEffect(() => {
    if (!getCacheStatus) {
      setCacheStatus(undefined);
      return;
    }
    const status = getCacheStatus(PRIVACY_POOL_ADDRESS);
    setCacheStatus(
      status
        ? {
            lastSyncedAt: status.lastSyncedAt,
            expiresAt: status.expiresAt,
            commitmentCount: status.commitmentCount,
          }
        : undefined
    );
  }, [getCacheStatus, chain?.id]);

  useEffect(() => {
    if (!getCacheStatus) return;
    const chainIdValue = chain?.id ?? 0;
    const unsubscribe = cacheSync.subscribe((event) => {
      if (event.chainId !== chainIdValue) return;
      if (event.address !== PRIVACY_POOL_ADDRESS_KEY) return;
      if (event.action === "clear") {
        setCacheStatus(undefined);
        return;
      }
      if (event.action === "refresh") {
        const status = getCacheStatus(PRIVACY_POOL_ADDRESS);
        setCacheStatus(
          status
            ? {
                lastSyncedAt: status.lastSyncedAt,
                expiresAt: status.expiresAt,
                commitmentCount: status.commitmentCount,
              }
            : undefined
        );
      }
    });
    return unsubscribe;
  }, [cacheSync, getCacheStatus, chain?.id]);

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
          account: address,
        } as any);
        return { hash: txHash as string };
      },
    });
  }, [publicClient, writeContract, chain, address, loadCommitments]);

  const generateProof = async (overrideNote?: string) => {
    if (!address || !withdrawFlow) {
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
      setFeedback({
        type: "info",
        message: "Fetching deposit events to build Merkle tree...",
      });

      const { proof: generatedProof, publicSignals: signals, cacheInfo } =
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
    } finally {
      setIsProving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!proof || !publicSignals || !address || !chain || !withdrawFlow) {
      setFeedback({
        type: "error",
        message: "Proof, public signals, or wallet connection is missing.",
      });
      return;
    }

    if (!isValidRecipientAddress(address)) {
      setFeedback({
        type: "error",
        message: "Recipient address is invalid.",
      });
      return;
    }

    try {
      await withdrawFlow.submitWithdrawal({
        proof,
        publicSignals,
        recipient: address as `0x${string}`,
        fee: 0n,
        relayer: ethers.ZeroAddress as `0x${string}`,
        account: address as `0x${string}`,
        chain,
      });
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
