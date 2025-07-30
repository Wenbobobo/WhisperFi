// src/components/DepositCard.tsx
"use client";

import { useState, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { UserRejectedRequestError } from "viem";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";

import { CONTRACTS } from "../config/contracts";
const PRIVACY_POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS as `0x${string}`;
import { generateNote, parseNote, generateCommitment } from "../utils/crypto";
import PrivacyPoolArtifact from "../abi/PrivacyPool.json";

const PrivacyPoolAbi = PrivacyPoolArtifact.abi;

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

export default function DepositCard() {
  const [note, setNote] = useState("");
  const [commitment, setCommitment] = useState("");
  const [userFriendlyError, setUserFriendlyError] = useState<string | null>(null);
  const { address, chain } = useAccount();
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // 🔍 DEBUG: 监控交易状态和错误
  useEffect(() => {
    if (error) {
      console.error("=== TRANSACTION ERROR ===");
      console.error("Error Object:", error);
      console.error("Error Message:", error.message);
      console.error("Error Cause:", error.cause);
      console.error("Error Stack:", error.stack);
      console.error("========================");

      // 为不同类型的错误设置用户友好的信息
      if (error instanceof UserRejectedRequestError) {
        setUserFriendlyError("交易已取消 - 您在钱包中拒绝了交易请求。");
      } else if (error.message?.includes("insufficient funds")) {
        setUserFriendlyError("余额不足 - 您的账户余额不足以完成此次存款。");
      } else if (error.message?.includes("User denied")) {
        setUserFriendlyError("交易已取消 - 您在钱包中拒绝了交易请求。");
      } else {
        // 其他未知错误，显示简化的错误信息
        const shortMessage = (error as any).shortMessage || error.message;
        setUserFriendlyError(`交易失败: ${shortMessage}`);
      }
    } else {
      // 清除错误状态
      setUserFriendlyError(null);
    }
  }, [error]);

  useEffect(() => {
    if (hash) {
      console.log("=== TRANSACTION SUBMITTED ===");
      console.log("Transaction Hash:", hash);
      console.log("Is Confirming:", isConfirming);
      console.log("Is Confirmed:", isConfirmed);
      console.log("============================");
    }
  }, [hash, isConfirming, isConfirmed]);

  const handleDeposit = async () => {
    const newNote = generateNote();
    const { secret, nullifier } = parseNote(newNote);
    const newCommitment = await generateCommitment(
      secret,
      ethers.parseEther("0.1").toString()
    );

    setNote(newNote);
    setCommitment(newCommitment);

    if (address && chain) {
      // 🔍 DEBUG: 添加详细的调试日志
      console.log("=== DEPOSIT DEBUG INFO ===");
      console.log("Target Contract Address:", PRIVACY_POOL_ADDRESS);
      console.log("Function Name:", "deposit");
      console.log("Commitment:", newCommitment);
      console.log("Value (ETH):", ethers.parseEther("0.1").toString());
      console.log("User Address:", address);
      console.log("Chain ID:", chain.id);
      console.log("ABI Function Names:", PrivacyPoolAbi.filter(item => item.type === 'function').map(item => item.name));
      console.log("========================");

      writeContract({
        address: PRIVACY_POOL_ADDRESS,
        abi: PrivacyPoolAbi,
        functionName: "deposit",
        args: [newCommitment],
        value: ethers.parseEther("0.1"),
        account: address,
        chain: chain,
      });
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      className="bg-gray-800 border border-gray-700 rounded-lg p-6 sm:p-8 max-w-md mx-auto mt-10 shadow-lg"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Make a Deposit
        </h2>
        <p className="text-gray-400 mt-2">
          Click the button to generate a new private note and deposit 0.1 ETH.
          The note is your key to your funds.
        </p>
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {isConfirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 text-center">
                <h3 className="text-xl font-semibold text-green-300">
                  Deposit Successful!
                </h3>
                {hash && chain?.blockExplorers?.default.url && (
                  <p className="text-sm text-gray-300 mt-2">
                    Tx:{" "}
                    <a
                      href={`${chain.blockExplorers.default.url}/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {hash.slice(0, 10)}...{hash.slice(-8)}
                    </a>
                  </p>
                )}
              </div>
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mt-4">
                <h4 className="font-bold text-red-300">
                  ACTION REQUIRED: Copy and save this note!
                </h4>
                <textarea
                  readOnly
                  value={note}
                  className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-2 mt-2 font-mono text-sm resize-none h-28"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <p className="text-xs text-red-400 mt-1">
                  If you lose this note, you will lose your funds. There is no
                  recovery.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="deposit_button">
              <button
                onClick={handleDeposit}
                disabled={isPending || isConfirming}
                className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100"
              >
                {isPending ? (
                  <>
                    <Spinner /> Confirm in wallet...
                  </>
                ) : isConfirming ? (
                  <>
                    <Spinner /> Depositing...
                  </>
                ) : (
                  "Generate Note & Deposit 0.1 ETH"
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {userFriendlyError && (
        <motion.div
          className="bg-red-900/50 border border-red-700 rounded-lg p-3 mt-4 text-sm text-red-300"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {userFriendlyError}
        </motion.div>
      )}
    </motion.div>
  );
}
