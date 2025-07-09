// src/app/page.tsx
"use client";


import { AppBar, Toolbar, Typography, Button, Container, Box, Tabs, Tab } from '@mui/material';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useEffect, useState } from 'react';
import DepositCard from '../components/DepositCard';
import WithdrawCard from '../components/WithdrawCard';

// Wallet Connection Component
function ConnectWalletButton() {
  // ... (same as before)
}

// Tab Panel Component
function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Main Page Layout
export default function Home() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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
          <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} centered>
                <Tab label="Deposit" />
                <Tab label="Withdraw" />
              </Tabs>
            </Box>
            <TabPanel value={tabValue} index={0}>
              <DepositCard />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <WithdrawCard />
            </TabPanel>
          </Box>
        ) : (
          <Typography variant="body1">
            Connect your wallet to begin.
          </Typography>
        )}
      </Container>
    </Box>
  );
}

