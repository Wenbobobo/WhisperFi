// src/components/WithdrawCard.tsx
"use client";

import React, { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  usePublicClient,
} from "wagmi";
import { ethers } from "ethers";
// @ts-ignore
import { groth16 } from "snarkjs";
import { motion, AnimatePresence } from "framer-motion";

import { CONTRACTS } from "../config/contracts";
import { isValidRecipientAddress } from "../utils/validation";
import PrivacyPoolArtifact from "../abi/PrivacyPool.json";
import { parseNote, generateCommitment, generateNullifierHash, CircuitCompatibleMerkleTree } from "../utils/crypto";
import { generateWithdrawProof } from "../lib/zk/withdraw";
import { buildWithdrawCircuitInputs } from "../lib/zk/builder";
import { toWithdrawArgs } from "../lib/zk/submit";
import WithdrawForm from "./WithdrawForm";

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
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);

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

  const generateProof = async (noteArg?: string) => {
    if (!address || !publicClient) {
      setFeedback({
        type: "error",
        message: "Please connect your wallet first.",
      });
      return;
    }
    const noteToUse = noteArg ?? note;
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
      // 1. Parse note and generate hashes
      const { secret } = parseNote(noteToUse);
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

      // 3. Prepare circuit inputs via builder
      console.log("🔍 构建Merkle树并准备电路输入...");
      const ZERO = "5738151709701895985996174429509233181681189240650583716378205449277091542814";
      const { input, merkle } = await buildWithdrawCircuitInputs(
        secret,
        depositAmount.toString(),
        commitments,
        leafIndex,
        ZERO,
        16
      );
      const { pathElements, pathIndices, root: merkleRoot } = merkle;
      console.log("✅ Merkle树构建完成");
      console.log("Merkle根:", merkleRoot);
      console.log("路径元素数量:", pathElements.length);
      console.log("路径索引数量:", pathIndices.length);
      console.log("Secret:", secret, "Type:", typeof secret);
      console.log("NullifierHash:", nullifierHash, "Type:", typeof nullifierHash);
      console.log("DepositAmount:", depositAmount, "Type:", typeof depositAmount);
      console.log("PathElements:", pathElements);
      console.log("PathIndices:", pathIndices);
      console.log("MerkleRoot:", merkleRoot);

      // === 诊断日志：地址格式转换验证 ===
      console.log("🔍 Address conversion diagnostic:");
      console.log("Raw address:", address);
      console.log("Address type:", typeof address);
      console.log("Address length:", address?.length);
      console.log("Recipient address valid:", isValidRecipientAddress(address));
      // === 诊断日志：输入对象验证 ===
      console.log("🔍 Circuit input validation:");
      console.log("Input keys:", Object.keys(input));
      console.log(
        "Input values types:",
        Object.fromEntries(Object.entries(input as any).map(([k, v]) => [k, typeof v]))
      );
      console.log("✅ Circuit input prepared successfully:", {
        secret: (input as any).secret.toString(),
        amount: (input as any).amount.toString(),
        pathElements: (input as any).pathElements.map((el: any) => el.toString()),
        merkleRoot: (input as any).merkleRoot.toString(),
        nullifier: (input as any).nullifier.toString(),
      });

      // 5. Generate ZK proof
      setFeedback({
        type: "info",
        message: "Generating ZK proof... this is computationally intensive.",
      });
      const { proof, publicSignals } = await generateWithdrawProof(input, "/zk/withdraw.wasm", "/zk/withdraw.zkey");

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
      // 重置proof和publicSignals状态，确保状态一致性
      setProof(null);
      setPublicSignals(null);
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

    // --- 诊断日志开始 ---
    console.log("--- 准备提交取款交易 ---");

    // 1. 格式化公共信号 (publicSignals)
    // publicSignals[0] 是 merkleRoot
    // publicSignals[1] 是 nullifierHash
    const rootFromSignal = BigInt(publicSignals[0]);
    const nullifierFromSignal = BigInt(publicSignals[1]);
    
    const rootBytes32 = ethers.toBeHex(rootFromSignal, 32);
    const nullifierBytes32 = ethers.toBeHex(nullifierFromSignal, 32);

    console.log("原始 Public Signals:", publicSignals);
    console.log("Merkle Root (来自信号):", rootFromSignal.toString());
    console.log("格式化后的 Merkle Root (bytes32):", rootBytes32);
    console.log("Nullifier Hash (来自信号):", nullifierFromSignal.toString());
    console.log("格式化后的 Nullifier Hash (bytes32):", nullifierBytes32);

    console.log("原始 Proof:", JSON.stringify(proof, null, 2));

    // 3. 准备其他参数
    const recipientAddress = address;
    const amount = ethers.parseEther("0.1");
    console.log("接收地址 (Recipient):", recipientAddress);
    console.log("提款金额 (Amount):", amount.toString());
    
    // 额外的调试信息
    console.log("=== Proof 调试信息 ===");
    console.log("Proof A:", formattedProof.a);
    console.log("Proof B:", formattedProof.b);
    console.log("Proof C:", formattedProof.c);
    console.log("Root bytes32:", rootBytes32);
    console.log("Nullifier bytes32:", nullifierBytes32);
    console.log("Recipient:", recipientAddress);
    console.log("Fee:", BigInt(0));
    console.log("Relayer:", ethers.ZeroAddress);

    const finalArgs = toWithdrawArgs(
      proof,
      publicSignals,
      recipientAddress as `0x${string}`,
      BigInt(0),
      ethers.ZeroAddress as `0x${string}`
    );

    console.log("--- 最终发送给 writeContract 的参数 ---");
    console.log("函数名: withdraw");
    console.log("参数 (args):", JSON.stringify(finalArgs, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
    console.log("------------------------------------");
    // --- 诊断日志结束 ---

    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: "withdraw",
      args: finalArgs,
      chain: chain,
      account: address,
    });
  };

  const handleComplianceReport = () => {
    console.log("Opening compliance report modal");
    setIsComplianceModalOpen(true);
  };

  const closeComplianceModal = () => {
    console.log("Closing compliance report modal");
    setIsComplianceModalOpen(false);
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

        <div className="mt-4 space-y-3">
          <WithdrawForm
            onGenerateProof={async (n: string) => {
              setNote(n);
              await generateProof(n);
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
