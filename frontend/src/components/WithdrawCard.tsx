// src/components/WithdrawCard.tsx
"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  usePublicClient,
} from "wagmi";
import { ethers } from "ethers";
import { MerkleTree } from "fixed-merkle-tree";
// @ts-ignore
import { groth16 } from "snarkjs";
import { motion, AnimatePresence } from "framer-motion";

import { CONTRACTS } from "../config/contracts";
import PrivacyPoolArtifact from "../abi/PrivacyPool.json";
import {
  parseNote,
  generateCommitment,
  generateNullifierHash,
} from "../utils/crypto";
import { buildPoseidon } from "circomlibjs";

const PRIVACY_POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS as `0x${string}`;
const PrivacyPoolAbi = PrivacyPoolArtifact.abi;
const steps = ["Generate Proof", "Submit Transaction"];

// A simple spinner component
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
  const [feedback, setFeedback] = useState({ type: "", message: "" });

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

  const generateProof = async () => {
    if (!address || !publicClient) {
      setFeedback({
        type: "error",
        message: "Please connect your wallet first.",
      });
      return;
    }
    if (!note) {
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
      // 1. Parse note and generate hashes
      const { secret } = parseNote(note);
      const depositAmount = ethers.parseEther("0.1");
      const commitment = await generateCommitment(
        secret,
        depositAmount.toString()
      );
      const nullifierHash = await generateNullifierHash(secret);

      // 2. Fetch deposit events to build the Merkle tree
      setFeedback({
        type: "info",
        message: "Fetching deposit events to build Merkle tree...",
      });
      const depositEvents = await publicClient.getLogs({
        address: PRIVACY_POOL_ADDRESS,
        event: {
          type: "event",
          name: "Deposit",
          inputs: [
            { type: "bytes32", name: "commitment", indexed: true },
            { type: "uint32", name: "leafIndex", indexed: false },
            { type: "uint256", name: "timestamp", indexed: false },
          ],
        },
        fromBlock: "earliest",
      });

      const commitments = depositEvents.map((event) => event.args.commitment!);
      if (commitments.length === 0) {
        throw new Error("No deposit events found. The pool is empty.");
      }

      // 3. Find the leaf index and build the tree
      const leafIndex = commitments.findIndex((c) => c === commitment);
      if (leafIndex < 0) {
        throw new Error(
          "Your deposit commitment was not found in the Merkle tree. Please check your note or wait for your deposit to be confirmed."
        );
      }

      const poseidon = await buildPoseidon();
      const hashFunction = (left: any, right: any) => poseidon([left, right]);
      const tree = new MerkleTree(20, commitments, {
        hashFunction,
        zeroElement:
          "21663839004416932945382355908790599225266501822907911457504978515578255421292",
      });

      const { pathElements, pathIndices } = tree.path(leafIndex);

      // 4. Prepare circuit inputs
      const input = {
        secret: BigInt(secret),
        amount: depositAmount,
        pathElements: pathElements,
        pathIndices: pathIndices,
        merkleRoot: tree.root,
        nullifier: BigInt(nullifierHash),
      };

      // 5. Generate ZK proof
      setFeedback({
        type: "info",
        message: "Generating ZK proof... this is computationally intensive.",
      });
      const { proof, publicSignals } = await groth16.fullProve(
        input,
        "/zk/withdraw.wasm",
        "/zk/withdraw.zkey"
      );

      setProof(proof);
      setPublicSignals(publicSignals);
      setActiveStep(1);
      setFeedback({
        type: "success",
        message:
          "Proof generated successfully! You can now submit the withdrawal.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: `Proof generation failed: ${err.message}`,
      });
    } finally {
      setIsProving(false);
    }
  };

  const handleWithdraw = () => {
    if (!proof || !publicSignals || !address || !chain) {
      setFeedback({
        type: "error",
        message: "Proof, public signals, or wallet connection is missing.",
      });
      return;
    }

    const rootBytes32 = ethers.toBeHex(BigInt(publicSignals[0]), 32);
    const nullifierBytes32 = ethers.toBeHex(BigInt(publicSignals[1]), 32);

    const formattedProof = {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]],
      ],
      c: [proof.pi_c[0], proof.pi_c[1]],
    };

    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: "withdraw",
      args: [
        formattedProof.a,
        formattedProof.b,
        formattedProof.c,
        rootBytes32,
        nullifierBytes32,
        address,
        ethers.parseEther("0.1"),
      ],
      chain: chain,
      account: address,
    });
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const getButtonText = () => {
    if (activeStep === 0) {
      return isProving ? "Generating Proof..." : "Verify Note & Generate Proof";
    }
    if (activeStep === 1) {
      if (isPending) return "Confirm in wallet...";
      if (isConfirming) return "Submitting Transaction...";
      return "Withdraw 0.1 ETH";
    }
  };

  const finalError = writeError || receiptError;

  return (
    <motion.div
      className="bg-gray-800 border border-gray-700 rounded-lg p-6 sm:p-8 max-w-md mx-auto mt-10 shadow-lg"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Withdraw Funds
        </h2>
        <p className="text-gray-400 mt-2">
          Enter your private note to withdraw your deposited funds.
        </p>
      </div>

      <div className="mt-6">
        {/* Stepper */}
        <div className="flex justify-between mb-4">
          {steps.map((label, index) => (
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

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isProving || isPending || isConfirming || activeStep === 1}
          placeholder="Paste the complete note you saved during deposit..."
          className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 font-mono text-sm resize-none h-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        <div className="mt-4 space-y-3">
          <button
            onClick={activeStep === 0 ? generateProof : handleWithdraw}
            disabled={!note || isProving || isPending || isConfirming}
            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100"
          >
            {(isProving || isPending || isConfirming) && <Spinner />}
            {getButtonText()}
          </button>

          <button
            onClick={handleComplianceReport}
            disabled={!note || isProving || isPending || isConfirming}
            className="w-full flex items-center justify-center bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100"
          >
            Generate Compliance Report
          </button>
        </div>
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
                : feedback.type === "success"
                ? "bg-green-900/50 border border-green-700 text-green-300"
                : isConfirmed
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
              feedback.message
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compliance Report Modal */}
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
                    This feature allows you to generate a cryptographic report
                    to prove the origin of your funds.
                  </p>
                  <p>
                    It is currently under development and will be available
                    soon.
                  </p>
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
