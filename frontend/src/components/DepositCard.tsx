// src/components/DepositCard.tsx
"use client";

import { useState, useEffect } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress, Link, Alert } from '@mui/material';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { ethers } from 'ethers';

// We will get the ABI and address from a centralized config file later
import { CONTRACTS } from '../config/contracts';
const PRIVACY_POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS as `0x${string}`;
import { generateNote, parseNote, generateCommitment } from '../utils/crypto';
import PrivacyPoolArtifact from '../abi/PrivacyPool.json';

const PrivacyPoolAbi = PrivacyPoolArtifact.abi;

export default function DepositCard() {
  const [note, setNote] = useState('');
  const [commitment, setCommitment] = useState('');
  const { chain, address } = useAccount();
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const handleDeposit = async () => {
    const newNote = generateNote();
    const { secret, nullifier } = parseNote(newNote);
    const depositAmount = ethers.parseEther('0.1');
    const newCommitment = await generateCommitment(secret, depositAmount);

    console.log('Deposit - Generated Note:', newNote);
    console.log('Deposit - Secret:', secret);
    console.log('Deposit - Nullifier:', nullifier);
    console.log('Deposit - Amount:', depositAmount.toString());
    console.log('Deposit - Commitment:', newCommitment);

    setNote(newNote);
    setCommitment(newCommitment);

    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: 'deposit',
      args: [newCommitment],
      value: depositAmount,
      chain: chain,
      account: address,
    });
  };

  return (
    <Card sx={{ mt: 4, maxWidth: 600, mx: 'auto' }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Make a Deposit
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click the button to generate a new private note and deposit 0.1 ETH. The note is your key to your funds.
        </Typography>
        
        {isConfirmed ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="h6">Deposit Successful!</Typography>
            <Typography sx={{ mt: 1, mb: 1 }}>Your transaction hash is: 
              <Link href={`${chain?.blockExplorers?.default.url}/tx/${hash}`} target="_blank"> {hash.slice(0, 10)}...</Link>
            </Typography>
            <Alert severity="error" sx={{ mt: 2 }}>
              <strong>ACTION REQUIRED: Copy and save this note!</strong>
              <TextField
                fullWidth
                variant="outlined"
                value={note}
                multiline
                InputProps={{ readOnly: true }}
                sx={{ mt: 1, mb: 1, fontFamily: 'monospace' }}
              />
              If you lose this note, you will lose your funds. There is no recovery.
            </Alert>
          </Alert>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleDeposit}
              disabled={isPending || isConfirming}
              fullWidth
              size="large"
            >
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Depositing...' : 'Generate Note & Deposit 0.1 ETH'}
            </Button>
            {(isPending || isConfirming) && (
              <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} />
            )}
          </Box>
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