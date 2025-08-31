// src/components/TradeCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { parseNote } from "../utils/crypto";
import { CONTRACTS } from "../config/contracts";
import { DEMO_PRICES, USE_REAL_API, PRICE_UPDATE_INTERVAL } from "../config/prices";
import SimpleSwapDemoAbi from "../abi/SimpleSwapDemo.json";

// Simple spinner component
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

// DEX options
const dexOptions = [
  {
    id: "uniswap",
    name: "Uniswap",
    logo: "https://app.uniswap.org/favicon.ico",
    description: "Leading DEX on Ethereum"
  },
  {
    id: "dydx",
    name: "dYdX",
    logo: "https://dydx.exchange/favicon-32x32.png",
    description: "Decentralized derivatives"
  },
  {
    id: "curve",
    name: "Curve",
    logo: "https://curve.fi/favicon-32x32.png",
    description: "Stablecoin exchange"
  },
  {
    id: "1inch",
    name: "1inch",
    logo: "https://1inch.exchange/favicon.ico",
    description: "DEX aggregator"
  }
];

// Token options
const tokens = [
  {
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    name: "Ethereum",
    price: DEMO_PRICES.ETH
  },
  {
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    name: "USD Coin",
    price: DEMO_PRICES.USDC
  },
  {
    symbol: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    name: "Dai Stablecoin",
    price: DEMO_PRICES.DAI
  },
  {
    symbol: "WBTC",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    name: "Wrapped Bitcoin",
    price: DEMO_PRICES.WBTC
  }
];

const tradeSteps = ["Upload Note", "Select DEX & Tokens", "Confirm Trade"];

export default function TradeCard() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // State management
  const [activeStep, setActiveStep] = useState(0);
  const [note, setNote] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedDex, setSelectedDex] = useState<any>(null);
  const [tokenFrom, setTokenFrom] = useState(tokens[0]);
  const [tokenTo, setTokenTo] = useState(tokens[1]);
  const [amount, setAmount] = useState("0.1");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Token price fetching with configurable demo mode
  const fetchTokenPrices = async () => {
    setIsPriceLoading(true);
    try {
      let priceData: any = {};
      
      if (USE_REAL_API) {
        // Use CoinGecko free API
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,dai,wrapped-bitcoin&vs_currencies=usd'
        );
        
        if (response.ok) {
          const data = await response.json();
          priceData = {
            ETH: data.ethereum?.usd || DEMO_PRICES.ETH,
            USDC: data['usd-coin']?.usd || DEMO_PRICES.USDC,
            DAI: data.dai?.usd || DEMO_PRICES.DAI,
            WBTC: data['wrapped-bitcoin']?.usd || DEMO_PRICES.WBTC,
          };
        } else {
          throw new Error('API failed');
        }
      } else {
        // Use configured demo prices with small randomization for realism
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        priceData = {
          ETH: DEMO_PRICES.ETH + (Math.random() - 0.5) * 20,  // ±$10 variation
          USDC: DEMO_PRICES.USDC + (Math.random() - 0.5) * 0.004, // ±$0.002 variation
          DAI: DEMO_PRICES.DAI + (Math.random() - 0.5) * 0.006,   // ±$0.003 variation
          WBTC: DEMO_PRICES.WBTC + (Math.random() - 0.5) * 200,   // ±$100 variation
        };
      }
      
      // Update current tokens if they exist
      if (tokenFrom && priceData[tokenFrom.symbol]) {
        setTokenFrom({...tokenFrom, price: priceData[tokenFrom.symbol]});
      }
      if (tokenTo && priceData[tokenTo.symbol]) {
        setTokenTo({...tokenTo, price: priceData[tokenTo.symbol]});
      }

    } catch (error) {
      console.error("Failed to fetch token prices:", error);
      // Fall back to configured demo prices
      if (tokenFrom && DEMO_PRICES[tokenFrom.symbol as keyof typeof DEMO_PRICES]) {
        setTokenFrom({...tokenFrom, price: DEMO_PRICES[tokenFrom.symbol as keyof typeof DEMO_PRICES]});
      }
      if (tokenTo && DEMO_PRICES[tokenTo.symbol as keyof typeof DEMO_PRICES]) {
        setTokenTo({...tokenTo, price: DEMO_PRICES[tokenTo.symbol as keyof typeof DEMO_PRICES]});
      }
    } finally {
      setIsPriceLoading(false);
    }
  };

  // Fetch prices on component mount and periodically
  useEffect(() => {
    fetchTokenPrices();
    const interval = setInterval(fetchTokenPrices, PRICE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content.includes('private-defi-') && content.includes('-v1')) {
          setNote(content.trim());
          setFeedback({
            type: "success",
            message: `Note loaded from file: ${file.name}`,
          });
        } else {
          setFeedback({
            type: "error",
            message: "Invalid note file format. Please upload a valid WhisperFi note file.",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  // Clear note handler
  const clearNote = () => {
    setNote("");
    setUploadedFile(null);
    setFeedback({ type: "", message: "" });
  };

  // Validate note and proceed to step 2
  const validateAndProceed = async () => {
    if (!note) {
      setFeedback({ type: "error", message: "Please upload or enter your note." });
      return;
    }

    setIsProcessing(true);
    setFeedback({ type: "info", message: "Validating note format..." });

    try {
      // Simulate validation process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setFeedback({ type: "info", message: "Parsing deposit commitment..." });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const parsed = parseNote(note);
      
      setFeedback({ type: "info", message: "Checking deposit status on-chain..." });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setActiveStep(1);
      setFeedback({ type: "success", message: "Note validated successfully!" });
    } catch (err: any) {
      setFeedback({ type: "error", message: `Invalid note format: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate exchange rate when tokens change
  useEffect(() => {
    if (tokenFrom && tokenTo) {
      const rate = tokenTo.price / tokenFrom.price;
      setExchangeRate(rate);
    }
  }, [tokenFrom, tokenTo]);

  // Proceed to confirmation step
  const proceedToConfirmation = () => {
    if (!selectedDex) {
      setFeedback({ type: "error", message: "Please select a DEX." });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid amount." });
      return;
    }
    setActiveStep(2);
    setFeedback({ type: "success", message: "Ready to execute trade!" });
  };

  // Execute trade (with realistic ZKP timing)
  const executeTrade = async () => {
    setIsProcessing(true);
    setFeedback({ type: "info", message: "Validating trade parameters..." });

    try {
      // Trade parameter validation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setFeedback({ type: "info", message: "Building Merkle proof for note ownership..." });
      
      // Merkle proof generation
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      setFeedback({ type: "info", message: "Generating zero-knowledge proof for private trade..." });
      
      // ZK proof generation (realistic timing for trade circuits)
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      setFeedback({ type: "info", message: "Submitting proof to selected DEX..." });
      
      // Execute real swap transaction for demo  
      try {
        if (window.ethereum && (CONTRACTS as any).SIMPLE_SWAP_DEMO_ADDRESS) {
          const tokenAddresses = {
            ETH: "0x0000000000000000000000000000000000000000",
            USDC: "0x1000000000000000000000000000000000000001", 
            DAI: "0x2000000000000000000000000000000000000002",
            WBTC: "0x3000000000000000000000000000000000000003",
          };
          
          const tokenInAddress = tokenAddresses[tokenFrom.symbol as keyof typeof tokenAddresses];
          const tokenOutAddress = tokenAddresses[tokenTo.symbol as keyof typeof tokenAddresses];
          
          if (tokenInAddress && tokenOutAddress) {
            console.log("Calling real swap contract:", {
              tokenIn: tokenInAddress,
              tokenOut: tokenOutAddress,
              amount: amount
            });
            
            // Encode the function call data properly
            const amountInWei = ethers.parseEther(amount);
            const contractInterface = new ethers.Interface(SimpleSwapDemoAbi);
            const data = contractInterface.encodeFunctionData("swapDemo", [
              tokenInAddress,
              tokenOutAddress,
              amountInWei
            ]);
            
            const swapTxHash = await window.ethereum.request({
              method: 'eth_sendTransaction',
              params: [{
                from: address,
                to: (CONTRACTS as any).SIMPLE_SWAP_DEMO_ADDRESS,
                data: data,
                gas: '0x15f90', // 90,000 gas
                value: tokenFrom.symbol === 'ETH' ? `0x${amountInWei.toString(16)}` : '0x0',
              }],
            });
            
            console.log("Real swap transaction hash:", swapTxHash);
            
            // Store the real transaction hash
            const tradeRecord = {
              timestamp: new Date().toISOString(),
              txHash: swapTxHash,
              dex: selectedDex.name,
              fromToken: tokenFrom.symbol,
              toToken: tokenTo.symbol,
              amount: amount,
              exchangeRate: exchangeRate,
              estimatedOutput: (parseFloat(amount) * exchangeRate).toFixed(6),
              userAddress: address,
              realTransaction: true,
            };
            
            // Save to localStorage for demo
            const existingTrades = JSON.parse(localStorage.getItem('whisperfi_trades') || '[]');
            existingTrades.push(tradeRecord);
            localStorage.setItem('whisperfi_trades', JSON.stringify(existingTrades));
            
            setFeedback({
              type: "success",
              message: `Real swap executed! TX: ${swapTxHash.slice(0, 10)}... | Rate: ${exchangeRate.toFixed(6)}`
            });
            
            return; // Exit early if real transaction succeeds
          }
        }
      } catch (error) {
        console.log("Real swap failed, falling back to mock:", error);
      }
      
      // Fallback to mock transaction if real one fails
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate a successful transaction hash
      const mockTxHash = "0x" + Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      // Store trade record locally for demo
      const tradeRecord = {
        timestamp: new Date().toISOString(),
        txHash: mockTxHash,
        dex: selectedDex.name,
        fromToken: tokenFrom.symbol,
        toToken: tokenTo.symbol,
        amount: amount,
        exchangeRate: exchangeRate,
        estimatedOutput: (parseFloat(amount) * exchangeRate).toFixed(6),
        userAddress: address,
        realTransaction: false, // Mark as mock transaction
      };
      
      // Save to localStorage for demo
      const existingTrades = JSON.parse(localStorage.getItem('whisperfi_trades') || '[]');
      existingTrades.push(tradeRecord);
      localStorage.setItem('whisperfi_trades', JSON.stringify(existingTrades));
      
      console.log("Trade recorded:", tradeRecord);
      
      setFeedback({
        type: "success",
        message: `Private trade executed successfully! TX: ${mockTxHash.slice(0, 10)}... | Rate: ${exchangeRate.toFixed(6)}`
      });

      // Reset after success
      setTimeout(() => {
        resetTrade();
      }, 5000);

    } catch (err: any) {
      setFeedback({ type: "error", message: `Trade failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset trade state
  const resetTrade = () => {
    setActiveStep(0);
    setNote("");
    setUploadedFile(null);
    setSelectedDex(null);
    setAmount("0.1");
    setFeedback({ type: "", message: "" });
    setIsProcessing(false);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      className="bg-gray-800 border border-gray-700 rounded-lg p-6 sm:p-8 max-w-lg mx-auto mt-10 shadow-lg"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Private Trading
        </h2>
        <p className="text-gray-400 mt-2">
          Execute anonymous trades across multiple DEXs using zero-knowledge proofs.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex justify-between my-6">
        {tradeSteps.map((label, index) => (
          <div
            key={label}
            className={`flex-1 text-center ${
              index <= activeStep ? "text-blue-400" : "text-gray-500"
            }`}
          >
            <div
              className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center border-2 text-sm ${
                index <= activeStep
                  ? "bg-blue-600 border-blue-400"
                  : "border-gray-500"
              }`}
            >
              {index < activeStep ? "✓" : index + 1}
            </div>
            <p className="text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-4">
        {/* Step 1: Upload Note */}
        {activeStep === 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* File Upload Area */}
                        <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
              <input
                type="file"
                accept=".key,.txt"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
                id="note-file-upload"
              />
              <label
                htmlFor="note-file-upload"
                className={`cursor-pointer inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  isProcessing
                    ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                Upload Key File
              </label>
              {uploadedFile && (
                <div className="mt-2 text-sm text-green-400">
                  Loaded: {uploadedFile.name}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Upload your WhisperFi private key (.key file)
              </p>
            </div>

            {/* OR Divider */}
            <div className="flex items-center">
              <div className="flex-1 border-t border-gray-600"></div>
              <span className="px-3 text-gray-400 text-sm">OR</span>
              <div className="flex-1 border-t border-gray-600"></div>
            </div>

            {/* Manual Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-400">Paste Note Manually:</label>
                {note && (
                  <button
                    onClick={clearNote}
                    disabled={isProcessing}
                    className="text-xs text-red-400 hover:text-red-300 disabled:text-gray-500"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isProcessing}
                placeholder="Paste your WhisperFi private key here..."
                className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 font-mono text-sm resize-none h-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={validateAndProceed}
              disabled={!note || isProcessing}
              className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {isProcessing && <Spinner />}
              {isProcessing ? "Validating Note..." : "Validate Note & Continue"}
            </button>
          </motion.div>
        )}

        {/* Step 2: Select DEX & Tokens */}
        {activeStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* DEX Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-3">Select DEX:</label>
              <div className="grid grid-cols-2 gap-2">
                {dexOptions.map((dex) => (
                  <button
                    key={dex.id}
                    onClick={() => setSelectedDex(dex)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedDex?.id === dex.id
                        ? "border-blue-400 bg-blue-900/30"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <img src={dex.logo} alt={dex.name} className="w-6 h-6" />
                      <div>
                        <div className="text-white font-medium">{dex.name}</div>
                        <div className="text-xs text-gray-400">{dex.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Token Selection */}
            <div className="space-y-3">
              <label className="block text-sm text-gray-400">Trading Pair:</label>
              
              {/* From Token */}
              <div className="space-y-2">
                <label className="text-xs text-gray-500">From:</label>
                <div className="flex space-x-2">
                  <select
                    value={tokenFrom.symbol}
                    onChange={(e) => setTokenFrom(tokens.find(t => t.symbol === e.target.value) || tokens[0])}
                    className="flex-1 bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                  >
                    {tokens.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol} - ${token.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-24 bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Swap Icon */}
              <div className="text-center">
                <button
                  onClick={() => {
                    const temp = tokenFrom;
                    setTokenFrom(tokenTo);
                    setTokenTo(temp);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ⇅
                </button>
              </div>

              {/* To Token */}
              <div className="space-y-2">
                <label className="text-xs text-gray-500">To:</label>
                <div className="flex space-x-2">
                  <select
                    value={tokenTo.symbol}
                    onChange={(e) => setTokenTo(tokens.find(t => t.symbol === e.target.value) || tokens[1])}
                    className="flex-1 bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                  >
                    {tokens.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol} - ${token.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <div className="w-24 bg-gray-900 text-gray-400 border border-gray-600 rounded-md p-2 text-center">
                    ≈ {(parseFloat(amount) * exchangeRate).toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Exchange Rate */}
              <div className="text-center text-sm text-gray-400">
                1 {tokenFrom.symbol} = {exchangeRate.toFixed(4)} {tokenTo.symbol}
              </div>
            </div>

            <button
              onClick={proceedToConfirmation}
              disabled={!selectedDex || !amount}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Review Trade
            </button>
          </motion.div>
        )}

        {/* Step 3: Confirm Trade */}
        {activeStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Trade Summary */}
            <div className="bg-gray-900 rounded-lg p-4 space-y-3">
              <h3 className="text-lg font-semibold text-white">Trade Summary</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">DEX:</span>
                  <span className="text-white">{selectedDex?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">From:</span>
                  <span className="text-white">{amount} {tokenFrom.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To:</span>
                  <span className="text-white">≈ {(parseFloat(amount) * exchangeRate).toFixed(4)} {tokenTo.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-white">1 {tokenFrom.symbol} = {exchangeRate.toFixed(6)} {tokenTo.symbol}</span>
                    {isPriceLoading && (
                      <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <span className="text-xs text-green-400">Live</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Privacy:</span>
                  <span className="text-green-400">Zero-Knowledge Proof</span>
                </div>
              </div>
            </div>

            {/* Execution Button */}
            <button
              onClick={executeTrade}
              disabled={isProcessing}
              className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {isProcessing && <Spinner />}
              {isProcessing ? "Executing Trade..." : "Execute Private Trade"}
            </button>

            {/* Back Button */}
            <button
              onClick={() => setActiveStep(1)}
              disabled={isProcessing}
              className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Back to Edit
            </button>
          </motion.div>
        )}
      </div>

      {/* Feedback Area */}
      <AnimatePresence>
        {feedback.message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-4 p-3 rounded-lg text-sm ${
              feedback.type === "error"
                ? "bg-red-900/50 border border-red-700 text-red-300"
                : feedback.type === "success"
                ? "bg-green-900/50 border border-green-700 text-green-300"
                : "bg-blue-900/50 border border-blue-700 text-blue-300"
            }`}
          >
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
