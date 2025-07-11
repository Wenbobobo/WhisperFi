// src/components/WithdrawCard.tsx
"use client";

import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress, Link, Alert, Stepper, Step, StepLabel } from '@mui/material';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { MerkleTree } from 'fixed-merkle-tree';
// @ts-ignore
import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';

import { CONTRACTS } from '../config/contracts';
import PrivacyPoolArtifact from '../abi/PrivacyPool.json';
import { parseNote, generateCommitment, generateNullifierHash } from '../utils/crypto';

const PRIVACY_POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS as `0x${string}`;
const PrivacyPoolAbi = PrivacyPoolArtifact.abi;
const steps = ['Generate Proof', 'Submit Transaction'];

export default function WithdrawCard() {
  const [note, setNote] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [isProving, setIsProving] = useState(false);
  const [proof, setProof] = useState<any>(null);
  const [publicSignals, setPublicSignals] = useState<any>(null);

  const { chain, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const generateProof = async () => {
    if (!address || !publicClient) {
      alert('Please connect your wallet first.');
      return;
    }
    if (!note) {
      alert('Please enter your note.');
      return;
    }

    setIsProving(true);
    setActiveStep(0);

    try {
      // 1. Parse the note to get secret and nullifier
      const { secret, nullifier } = parseNote(note);
      const commitment = await generateCommitment(secret, nullifier);
      const nullifierHash = await generateNullifierHash(nullifier);

      // 2. Fetch all deposit events to build the tree
      const depositEvents = await publicClient.getLogs({
        address: PRIVACY_POOL_ADDRESS,
        event: {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'commitment', type: 'bytes32' },
            { indexed: false, name: 'leafIndex', type: 'uint32' },
            { indexed: false, name: 'timestamp', type: 'uint256' }
          ],
          name: 'Deposit',
          type: 'event'
        },
        fromBlock: BigInt(0),
        toBlock: 'latest',
      });
      const commitments = depositEvents.map(event => event.args.commitment);
      
      // 3. Initialize Poseidon and build the Merkle tree
      const poseidon = await buildPoseidon();
      const hashFunction = (left: any, right: any) => {
        const result = poseidon([left, right]);
        return poseidon.F.toString(result);
      };
      const tree = new MerkleTree(20, commitments, { hashFunction, zeroElement: ethers.ZeroHash });

      // 4. Find the commitment and generate the Merkle proof
      const leafIndex = commitments.findIndex(c => c === commitment);
      if (leafIndex < 0) {
        throw new Error('Note not found in deposits. It may not have been mined yet, or the note is incorrect.');
      }
      const { pathElements, pathIndices } = tree.path(leafIndex);

      // 5. Prepare inputs for the ZK circuit
      const input = {
        root: tree.root,
        nullifierHash: nullifierHash,
        recipient: address,
        secret: secret,
        nullifier: nullifier,
        pathElements: pathElements,
        pathIndices: pathIndices,
      };

      // 6. Generate the ZK proof
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

    // Format the proof for the smart contract
    const formattedProof = {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
      c: [proof.pi_c[0], proof.pi_c[1]]
    };

    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: 'withdraw',
      args: [
        formattedProof.a,
        formattedProof.b, 
        formattedProof.c,
        publicSignals[0], // root
        publicSignals[1], // nullifierHash
        publicSignals[2], // recipient
        ethers.parseEther('0.1') // amount
      ],
      chain: chain,
      account: address,
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
          label="Your Private Note"
          variant="outlined"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isProving || isPending || isConfirming}
          sx={{ mb: 2 }}
          helperText="Paste the full note you saved during your deposit."
        />
        <Box sx={{ position: 'relative' }}>
          {activeStep === 0 && (
            <Button variant="contained" onClick={generateProof} disabled={!note || isProving} fullWidth size="large">
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
            <Alert severity="error" sx={{ mt: 2 }}>
                Error: {(error as any).shortMessage || error.message}
            </Alert>
        )}
      </CardContent>
    </Card>
  );
}