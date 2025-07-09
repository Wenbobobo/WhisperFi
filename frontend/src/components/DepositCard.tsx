// src/components/DepositCard.tsx
"use client";

import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress } from '@mui/material';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ethers } from 'ethers';

// You would get the ABI and address from your deployment artifacts
import PrivacyPoolAbi from '../abi/PrivacyPool.json';
const PRIVACY_POOL_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'; // Replace with your deployed address

export default function DepositCard() {
  const [commitment, setCommitment] = useState('');
  const { data: hash, writeContract, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ 
      hash, 
    });

  const handleDeposit = async () => {
    if (!commitment) {
      alert('Please enter a commitment.');
      return;
    }

    const formattedCommitment = ethers.isHexString(commitment, 32) 
      ? commitment 
      : ethers.encodeBytes32String(commitment);

    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: 'deposit',
      args: [formattedCommitment],
      value: ethers.parseEther('0.1'), // Matching the DEPOSIT_AMOUNT in the contract
    });
  };

  return (
    <Card sx={{ mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Make a Deposit
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          To deposit, generate a secret and its corresponding commitment. Keep the secret safe!
          You will need it for withdrawals. For now, you can enter any string as a secret.
        </Typography>
        <TextField
          fullWidth
          label="Secret / Commitment"
          variant="outlined"
          value={commitment}
          onChange={(e) => setCommitment(e.target.value)}
          disabled={isPending || isConfirming}
          sx={{ mb: 2 }}
        />
        <Box sx={{ position: 'relative' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleDeposit}
            disabled={isPending || isConfirming}
            fullWidth
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
          <Typography sx={{ mt: 2 }} color="success.main">
            Deposit successful! Transaction Hash: {hash}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
