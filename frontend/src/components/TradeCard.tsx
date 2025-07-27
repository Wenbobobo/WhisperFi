// src/components/TradeCard.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { MerkleTree } from 'fixed-merkle-tree';
// @ts-ignore
import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';

import { CONTRACTS } from '../config/contracts';
import PrivacyPoolArtifact from '../abi/PrivacyPool.json';
import { parseNote, generateNullifierHash } from '../utils/crypto';

const PRIVACY_POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS as `0x${string}`;
const PrivacyPoolAbi = PrivacyPoolArtifact.abi;
const tradeSteps = ['Get Quote', 'Generate Proof', 'Submit Trade', 'Completed'];

// A simple spinner component
const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// Mock data for token selectors
const tokens = [
  { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', logo: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/eth.svg' },
  { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', logo: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/dai.svg' },
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logo: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/usdc.svg' },
  { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', logo: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/wbtc.svg' },
];

export default function TradeCard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenIn, setTokenIn] = useState(tokens[0]);
  const [tokenOut, setTokenOut] = useState(tokens[1]);
  
  const [quote, setQuote] = useState<any>(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [activeStep, setActiveStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [intentId, setIntentId] = useState<string | null>(null);

  const resetState = () => {
    setNote('');
    setAmount('');
    setQuote(null);
    setFeedback({ type: '', message: '' });
    setActiveStep(0);
    setIsProcessing(false);
    setIntentId(null);
  }

  const handleGetQuote = async () => {
    if (!amount || !tokenIn || !tokenOut) {
      setFeedback({ type: 'error', message: 'Please fill in all fields.' });
      return;
    }
    setIsProcessing(true);
    setFeedback({ type: 'info', message: 'Getting quote...' });
    setQuote(null);

    try {
      const response = await fetch('http://localhost:3001/trade/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amount: ethers.parseEther(amount).toString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch quote.');
      
      setQuote(data);
      setFeedback({ type: 'success', message: `Quote received: ~${ethers.formatEther(data.quote.amountOut).slice(0, 8)} ${tokenOut.symbol}` });
      setActiveStep(1);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAndSubmitProof = async () => {
    if (!note || !quote || !address || !publicClient) {
        setFeedback({ type: 'error', message: 'Missing required information for trade.' });
        return;
    }

    setIsProcessing(true);
    try {
        // Step 1: Generate Proof
        setActiveStep(1);
        setFeedback({ type: 'info', message: 'Preparing to generate ZK proof...' });
        
        const { secret, nullifier, commitment } = parseNote(note);
        const nullifierHash = await generateNullifierHash(secret);

        setFeedback({ type: 'info', message: 'Fetching deposit events for Merkle tree...' });
        const depositEvents = await publicClient.getLogs({
            address: PRIVACY_POOL_ADDRESS,
            event: {
                type: 'event', name: 'Deposit',
                inputs: [{ type: 'bytes32', name: 'commitment', indexed: true }, { type: 'uint32', name: 'leafIndex', indexed: false }, { type: 'uint256', name: 'timestamp', indexed: false }]
            },
            fromBlock: 'earliest'
        });
        const commitments = depositEvents.map(event => event.args.commitment!);
        const leafIndex = commitments.findIndex(c => c === commitment);
        if (leafIndex < 0) throw new Error("Note commitment not found in Merkle tree.");

        const poseidon = await buildPoseidon();
        const hashFn = (l: any, r: any) => poseidon([l, r]);
        const tree = new MerkleTree(20, commitments, { hashFunction: hashFn, zeroElement: "21663839004416932945382355908790599225266501822907911457504978515578255421292" });
        const { pathElements, pathIndices } = tree.path(leafIndex);

        const circuitInputs = {
            secret: BigInt(secret),
            nullifier: BigInt(nullifierHash),
            merkleRoot: tree.root,
            pathElements: pathElements,
            pathIndices: pathIndices,
            
            // Trade specific inputs
            tokenOut: BigInt(tokenOut.address),
            amountOutMin: BigInt(quote.quote.amountOut), // Use quoted amount as minimum
            recipient: BigInt(address),
        };

        setFeedback({ type: 'info', message: 'Generating ZK proof... This can take a moment.' });
        const { proof, publicSignals } = await groth16.fullProve(circuitInputs, '/zk/trade.wasm', '/zk/trade.zkey');
        
        const formattedProof = {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            c: [proof.pi_c[0], proof.pi_c[1]]
        };

        // Step 2: Submit Intent
        setActiveStep(2);
        setFeedback({ type: 'info', message: 'Proof generated. Submitting trade intent to relayer...' });

        const intentRequest = {
            note,
            intent: {
                tokenIn: tokenIn.address,
                amountIn: ethers.parseEther(amount).toString(),
                tokenOut: tokenOut.address,
                recipient: address,
            },
            proof: formattedProof,
            publicSignals: {
                merkleRoot: ethers.toBeHex(BigInt(publicSignals[0]), 32),
                nullifierHash: ethers.toBeHex(BigInt(publicSignals[1]), 32),
            },
            quote,
        };

        const response = await fetch('http://localhost:3001/intent/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intentRequest),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to submit intent.');

        setIntentId(data.intentId);
        setFeedback({ type: 'info', message: `Trade intent submitted! ID: ${data.intentId}. Waiting for relayer...` });
    } catch (err: any) {
        console.error(err);
        setFeedback({ type: 'error', message: err.message });
        setActiveStep(0); // Reset on failure
    } finally {
        setIsProcessing(false);
    }
  };

  const pollIntentStatus = async (id: string) => {
    try {
        const response = await fetch(`http://localhost:3001/intent/status/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Status check failed.');

        switch (data.status) {
            case 'submitted':
                setFeedback({ type: 'info', message: `Transaction submitted to Flashbots! Tx Hash: ${data.txHash.slice(0,10)}...` });
                break;
            case 'confirmed':
                setFeedback({ type: 'success', message: `Trade Confirmed! Tx Hash: ${data.txHash.slice(0,10)}...` });
                setActiveStep(3);
                setIntentId(null); // Stop polling
                break;
            case 'failed':
                setFeedback({ type: 'error', message: `Trade Failed: ${data.message}` });
                setIntentId(null); // Stop polling
                setActiveStep(0);
                break;
            default: // pending
                setFeedback({ type: 'info', message: 'Intent is pending with relayer...' });
        }
    } catch (err: any) {
        console.error(err);
        setFeedback({ type: 'error', message: `Polling error: ${err.message}` });
    }
  };

  useEffect(() => {
    if (!intentId) return;

    const interval = setInterval(() => pollIntentStatus(intentId), 3000);
    return () => clearInterval(interval);
  }, [intentId]);


  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const getButton = () => {
    if (activeStep === 0) {
        return (
            <button onClick={handleGetQuote} disabled={isProcessing} className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all">
                {isProcessing ? <Spinner /> : 'Get Quote'}
            </button>
        )
    }
    return (
        <button onClick={generateAndSubmitProof} disabled={isProcessing || !!intentId} className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all">
            {isProcessing ? <Spinner /> : 'Execute Privacy Trade'}
        </button>
    )
  }

  return (
    <motion.div
      className="bg-gray-800 border border-gray-700 rounded-lg p-6 sm:p-8 max-w-md mx-auto mt-10 shadow-lg"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Private Trade</h2>
        <p className="text-gray-400 mt-2">Swap tokens privately using your deposited notes.</p>
      </div>

      {/* Stepper */}
      <div className="flex justify-between my-6">
          {tradeSteps.map((label, index) => (
              <div key={label} className={`flex-1 text-center ${index <= activeStep ? 'text-blue-400' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center border-2 ${index <= activeStep ? 'bg-blue-600 border-blue-400' : 'border-gray-500'}`}>
                      {index < activeStep ? '✔' : index + 1}
                  </div>
                  <p className="text-xs mt-1">{label}</p>
              </div>
          ))}
      </div>

      <div className="space-y-4">
        {/* Note Input */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isProcessing || activeStep > 0}
          placeholder="Paste the complete note you saved during deposit..."
          className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 font-mono text-sm resize-none h-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />

        {/* Token & Amount Inputs */}
        <div className="flex items-center justify-between space-x-2">
            <div className="w-1/3 bg-gray-700 p-2 rounded-md text-white flex items-center">
                <img src={tokenIn.logo} alt={tokenIn.symbol} className="h-6 w-6 mr-2" />
                <span>{tokenIn.symbol}</span>
            </div>
            <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isProcessing || activeStep > 0}
                placeholder="Amount"
                className="w-2/3 bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right disabled:opacity-50"
            />
        </div>

        <div className="flex items-center justify-center">
            <p className="text-2xl text-gray-400">↓</p>
        </div>

        <div className="flex items-center justify-between space-x-2">
            <div className="w-1/3 bg-gray-700 p-2 rounded-md text-white flex items-center">
                <img src={tokenOut.logo} alt={tokenOut.symbol} className="h-6 w-6 mr-2" />
                <span>{tokenOut.symbol}</span>
            </div>
            <div className="w-2/3 bg-gray-900 text-gray-400 border border-gray-600 rounded-md p-3 text-right h-[48px] flex items-center justify-end">
                {quote ? `~${ethers.formatEther(quote.quote.amountOut).slice(0, 8)}` : '...'}
            </div>
        </div>

        {/* Action Button */}
        <div className="mt-6">
            {getButton()}
        </div>
        
        {activeStep === 3 && (
             <button onClick={resetState} className="w-full mt-2 flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all">
                Start New Trade
            </button>
        )}

        {/* Status Area */}
        <AnimatePresence>
        {feedback.message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-4 p-3 rounded-lg text-sm text-center ${
                feedback.type === 'error' ? 'bg-red-900/50 border border-red-700 text-red-300' :
                feedback.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-300' :
                'bg-blue-900/50 border border-blue-700 text-blue-300'
            }`}>
            {feedback.message}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}