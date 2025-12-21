"use client";

import React from "react";
import { motion } from "framer-motion";

export type ProofStage = "building" | "generating" | "preparing" | "complete";

export interface ProofProgressBarProps {
  stage: ProofStage;
  progress: number;
  visible?: boolean;
}

const stageConfig = {
  building: {
    label: "Building Merkle Tree...",
    startProgress: 0,
    endProgress: 30,
    color: "bg-blue-500",
  },
  generating: {
    label: "Generating Proof...",
    startProgress: 30,
    endProgress: 90,
    color: "bg-purple-500",
  },
  preparing: {
    label: "Preparing Submission...",
    startProgress: 90,
    endProgress: 100,
    color: "bg-green-500",
  },
  complete: {
    label: "Complete!",
    startProgress: 100,
    endProgress: 100,
    color: "bg-green-600",
  },
};

export default function ProofProgressBar({
  stage,
  progress,
  visible = true,
}: ProofProgressBarProps) {
  if (!visible) {
    return null;
  }

  const config = stageConfig[stage];
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2"
      data-testid="proof-progress-bar"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">{config.label}</span>
        <span className="text-sm font-semibold text-gray-200">{clampedProgress}%</span>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <motion.div
          className={`h-3 rounded-full ${config.color} transition-all duration-300 ease-out`}
          initial={{ width: "0%" }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
        </motion.div>
      </div>

      {stage !== "complete" && (
        <p className="text-xs text-gray-400 mt-1">
          This may take a moment. Please do not close this window.
        </p>
      )}
    </motion.div>
  );
}
