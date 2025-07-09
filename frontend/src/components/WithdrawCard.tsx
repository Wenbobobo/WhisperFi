// src/components/WithdrawCard.tsx
"use client";

import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress, Link, Alert, Stepper, Step, StepLabel } from '@mui/material';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from 'wagmi';
import { ethers } from 'ethers';
// @ts-ignore
import { groth16 } from 'snarkjs';

import PrivacyPoolArtifact from '../abi/PrivacyPool.json';
const PRIVACY_POOL_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const PrivacyPoolAbi = PrivacyPoolArtifact.abi;

const steps = ['Generate Proof', 'Submit Transaction'];

export default function WithdrawCard() {
  const [secret, setSecret] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [isProving, setIsProving] = useState(false);
  const [proof, setProof] = useState<any>(null);
  const [publicSignals, setPublicSignals] = useState<any>(null);

  const { chain, address } = useAccount();
  // Remove simulation flag, use actual transaction confirmation
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { data: currentRoot } = useReadContract({
    address: PRIVACY_POOL_ADDRESS,
    abi: PrivacyPoolAbi,
    functionName: 'root',
  });

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const generateProof = async () => {
    if (!address) {
      alert('Please connect your wallet first.');
      return;
    }

    setIsProving(true);
    setActiveStep(0);

    // Calculate the commitment from the secret (same as in deposit)
    const commitment = ethers.keccak256(ethers.toUtf8Bytes(secret));

    try {
      console.log('Generating proof for commitment:', commitment);
      
      // In a production system, we would:
      // 1. Fetch all deposit events from the blockchain
      // 2. Build the Merkle tree with all commitments 
      // 3. Find our commitment in the tree
      // 4. Generate Merkle proof (path elements and indices)
      // 5. Use a proper withdraw circuit that proves:
      //    - Knowledge of the secret that generates the commitment
      //    - The commitment exists in the Merkle tree
      //    - Generate a unique nullifier to prevent double spending
      
      // For this demo, we'll simulate a working proof system
      console.log('Demo: Simulating zk-SNARK proof generation...');
      
      // Simulate the time it takes to generate a real proof
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a mock proof that matches the expected format
      const mockProof = {
        pi_a: [
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        ],
        pi_b: [
          [
            "0x2345678901bcdef02345678901bcdef02345678901bcdef02345678901bcdef0",
            "0xbcdef02345678901bcdef02345678901bcdef02345678901bcdef02345678901"
          ],
          [
            "0x3456789012cdef013456789012cdef013456789012cdef013456789012cdef01",
            "0xcdef013456789012cdef013456789012cdef013456789012cdef013456789012"
          ]
        ],
        pi_c: [
          "0x456789013def0234456789013def0234456789013def0234456789013def0234",
          "0xdef0234456789013def0234456789013def0234456789013def0234456789013"
        ]
      };

      const mockPublicSignals = [commitment]; // The commitment is the main public signal

      console.log('Mock proof generated successfully');
      console.log('Proof:', mockProof);
      console.log('Public signals:', mockPublicSignals);

      setProof(mockProof);
      setPublicSignals(mockPublicSignals);
      setActiveStep(1);
      
    } catch (err) {
      console.error('Error generating proof:', err);
      alert('Error in proof generation process. Please try again.');
    } finally {
      setIsProving(false);
    }
  };

  const handleWithdraw = () => {
    if (!proof || !publicSignals) {
      alert('Please generate a proof first.');
      return;
    }

    // Calculate nullifier for the withdrawal
    const nullifier = ethers.keccak256(ethers.toUtf8Bytes(`nullifier-${secret}`));
    
    // Format the proof for the smart contract
    const formattedProof = {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
      c: [proof.pi_c[0], proof.pi_c[1]]
    };

    console.log('Calling withdraw with:', {
      proof: formattedProof,
      root: currentRoot,
      nullifier,
      recipient: address,
      amount: ethers.parseEther('0.1')
    });

    // Call the smart contract's withdraw function
    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: 'withdraw',
      args: [
        formattedProof.a,
        formattedProof.b, 
        formattedProof.c,
        currentRoot, // _proofRoot
        nullifier,   // _nullifier  
        address,     // _recipient
        ethers.parseEther('0.1') // _amount
      ],
    });
  };

  return (
    <Card sx={{ mt: 4, maxWidth: 600, mx: 'auto' }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Withdraw Funds
        </Typography>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <TextField
          fullWidth
          label="Your Secret Note"
          variant="outlined"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={isProving || isPending || isConfirming}
          sx={{ mb: 2 }}
          helperText="Enter the secret note you saved during your deposit."
        />
        <Box sx={{ position: 'relative' }}>
          {activeStep === 0 && (
            <Button variant="contained" onClick={generateProof} disabled={!secret || isProving} fullWidth size="large">
              {isProving ? 'Generating Proof...' : 'Generate Proof'}
            </Button>
          )}
          {activeStep === 1 && (
            <Button variant="contained" onClick={handleWithdraw} disabled={isPending || isConfirming} fullWidth size="large">
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Submitting Transaction...' : 'Withdraw 0.1 ETH'}
            </Button>
          )}
          {(isProving || isPending || isConfirming) && <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} />}
        </Box>
        {isConfirmed && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Withdrawal successful! 
            <Link href={`${chain?.blockExplorers?.default.url}/tx/${hash}`} target="_blank" rel="noopener">
              View on Explorer
            </Link>
          </Alert>
        )}
        {error && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Transaction Failed:</strong> {error.message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This is expected in the demo as we're using mock proofs. In production, this would work with real zk-SNARK proofs.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
