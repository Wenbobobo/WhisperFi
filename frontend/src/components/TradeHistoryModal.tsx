// src/components/TradeHistoryModal.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TradeRecord {
  timestamp: string;
  txHash: string;
  dex: string;
  fromToken: string;
  toToken: string;
  amount: string;
  exchangeRate: number;
  estimatedOutput: string;
  userAddress: string;
  realTransaction?: boolean; // New field to distinguish real vs mock
}

interface TradeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TradeHistoryModal({ isOpen, onClose }: TradeHistoryModalProps) {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadTradeHistory();
    }
  }, [isOpen]);

  const loadTradeHistory = async () => {
    setIsLoading(true);
    try {
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Load from localStorage
      const storedTrades = JSON.parse(localStorage.getItem('whisperfi_trades') || '[]');
      setTrades(storedTrades.reverse()); // Show newest first
    } catch (error) {
      console.error("Failed to load trade history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem('whisperfi_trades');
    setTrades([]);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Trade History</h2>
            <div className="flex space-x-2">
              <button
                onClick={clearHistory}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Clear History
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-400">Loading trade history...</span>
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg">No trades found</div>
                <div className="text-gray-500 text-sm mt-2">
                  Your WhisperFi trade history will appear here
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {trades.map((trade, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${trade.realTransaction ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                        <span className="text-white font-medium">
                          {trade.amount} {trade.fromToken} → {trade.estimatedOutput} {trade.toToken}
                        </span>
                        {trade.realTransaction && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                            Real TX
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mt-1 sm:mt-0">
                        {formatTimestamp(trade.timestamp)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-gray-500">DEX</div>
                        <div className="text-gray-300">{trade.dex}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Rate</div>
                        <div className="text-gray-300">{trade.exchangeRate.toFixed(6)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Transaction</div>
                        <div className={`font-mono ${trade.realTransaction ? 'text-blue-400 cursor-pointer hover:text-blue-300' : 'text-blue-400'}`}>
                          {trade.realTransaction ? (
                            <a 
                              href={`http://localhost:8545/tx/${trade.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on local blockchain explorer"
                            >
                              {truncateHash(trade.txHash)}
                            </a>
                          ) : (
                            truncateHash(trade.txHash)
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">User</div>
                        <div className="text-gray-300 font-mono">
                          {truncateAddress(trade.userAddress)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-500 text-center">
              All trades are executed with zero-knowledge privacy protection
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
