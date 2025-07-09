// src/components/DepositCard.tsx
"use client";

import { useState, useMemo } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress, Link, Alert } from '@mui/material';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { ethers } from 'ethers';

// We will get the ABI and address from a centralized config file later
import PrivacyPoolAbi from '../abi/PrivacyPool.json';
const PRIVACY_POOL_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'; // Replace with your deployed address

export default function DepositCard() {
  const [secret, setSecret] = useState('');
  const { chain } = useAccount();
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  // Automatically generate the commitment from the secret
  const commitment = useMemo(() => {
    if (!secret) return '0x';
    return ethers.keccak256(ethers.toUtf8Bytes(secret));
  }, [secret]);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ 
      hash, 
    });

  const handleDeposit = async () => {
    if (!secret) {
      alert('Please enter a secret note to generate a commitment.');
      return;
    }

    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: 'deposit',
      args: [commitment],
      value: ethers.parseEther('0.1'), // Matching the DEPOSIT_AMOUNT in the contract
    });
  };

  return (
    <Card sx={{ mt: 4, maxWidth: 600, mx: 'auto' }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Make a Deposit
        </Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Important:</strong> Save your secret note! You will need it to withdraw your funds. Losing it means losing your funds.
        </Alert>
        <TextField
          fullWidth
          label="Your Secret Note"
          variant="outlined"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={isPending || isConfirming}
          sx={{ mb: 2 }}
          helperText="Enter any text. We will generate a secure commitment for you."
        />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordWrap: 'break-word' }}>
          <strong>Generated Commitment:</strong> {commitment}
        </Typography>
        <Box sx={{ position: 'relative' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleDeposit}
            disabled={!secret || isPending || isConfirming}
            fullWidth
            size="large"
          >
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Depositing...' : 'Deposit 0.1 ETH'}
          </Button>
          {(isPending || isConfirming) && (
            <CircularProgress
              size={24}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          )}
        </Box>
        {isConfirmed && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Deposit successful! 
            <Link href={`${chain?.blockExplorers?.default.url}/tx/${hash}`} target="_blank" rel="noopener">
              View on Explorer
            </Link>
          </Alert>
        )}
        {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
                Error: {error.shortMessage || error.message}
            </Alert>
        )}
      </CardContent>
    </Card>
  );
}