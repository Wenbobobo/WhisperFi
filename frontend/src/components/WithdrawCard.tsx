// src/components/WithdrawCard.tsx
"use client";

import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress, Link, Alert, Stepper, Step, StepLabel } from '@mui/material';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { MerkleTree } from 'fixed-merkle-tree';
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
  const publicClient = usePublicClient();
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { data: currentRoot } = useReadContract({
    address: PRIVACY_POOL_ADDRESS,
    abi: PrivacyPoolAbi,
    functionName: 'root',
  });

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const generateProof = async () => {
    if (!address || !publicClient) {
      alert('Please connect your wallet first.');
      return;
    }

    setIsProving(true);
    setActiveStep(0);

    try {
      // 1. Fetch all deposit events to build the tree
      const depositEvents = await publicClient.getLogs({
        address: PRIVACY_POOL_ADDRESS,
        event: {
          type: 'event',
          name: 'Deposit',
          inputs: [
            { name: 'commitment', type: 'bytes32', indexed: true },
            { name: 'leafIndex', type: 'uint256', indexed: false },
            { name: 'timestamp', type: 'uint256', indexed: false }
          ]
        },
        fromBlock: 0n,
        toBlock: 'latest',
      });
      const commitments = depositEvents.map(event => event.args.commitment);
      
      // 2. Build the Merkle tree
      const tree = new MerkleTree(20, commitments, { 
        hashFunction: (left, right) => ethers.keccak256(ethers.concat([left, right])),
        zeroElement: ethers.ZeroHash 
      });

      // 3. Find the commitment and generate the Merkle proof
      const commitment = ethers.keccak256(ethers.toUtf8Bytes(secret));
      const leafIndex = commitments.findIndex(c => c === commitment);
      if (leafIndex < 0) {
        throw new Error('Secret note not found in deposits.');
      }
      const { pathElements, pathIndices } = tree.path(leafIndex);

      // 4. Prepare inputs for the ZK circuit
      const input = {
        root: currentRoot,
        nullifier: ethers.keccak256(ethers.toUtf8Bytes(`nullifier-${secret}`)),
        recipient: address,
        amount: ethers.parseEther('0.1'),
        pathElements: pathElements,
        pathIndices: pathIndices,
      };

      // 5. Generate the ZK proof
      const { proof, publicSignals } = await groth16.fullProve(
        input,
        '/zk/withdraw.wasm',
        '/zk/withdraw.zkey'
      );

      setProof(proof);
      setPublicSignals(publicSignals);
      setActiveStep(1);
    } catch (err) {
      console.error(err);
      alert(`Error generating proof: ${err.message}`);
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
