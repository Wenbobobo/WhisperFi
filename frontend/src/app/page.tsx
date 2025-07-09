// src/app/page.tsx
"use client";

import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useEffect, useState } from 'react';

import DepositCard from '../components/DepositCard';

// 3. Wallet Connection Component
function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button variant="outlined" color="inherit" disabled>Loading...</Button>;
  }

  if (isConnected) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ mr: 2 }}>{`${address?.slice(0, 6)}...${address?.slice(-4)}`}</Typography>
        <Button variant="outlined" color="inherit" onClick={() => disconnect()}>Disconnect</Button>
      </Box>
    );
  }
  return <Button variant="outlined" color="inherit" onClick={() => connect({ connector: injected() })}>Connect Wallet</Button>;
}

// 4. Main Page Layout
export default function Home() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Private DeFi
          </Typography>
          <ConnectWalletButton />
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to the Next Generation of Private Finance
        </Typography>
        
        {mounted && isConnected ? (
          <DepositCard />
        ) : (
          <Typography variant="body1">
            Connect your wallet to begin.
          </Typography>
        )}
      </Container>
    </Box>
  );
}
