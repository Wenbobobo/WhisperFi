// frontend\src\app\providers.tsx
"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { WagmiProvider, createConfig, http } from "wagmi";
import { hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CONTRACTS } from "../config/contracts";
import "../e2e/helpers";

// 1. Create a new QueryClient instance
const queryClient = new QueryClient();

// 2. Configure Wagmi
const config = createConfig({
  chains: [hardhat],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(),
  },
});

// 3. Create a basic Material UI theme
const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined" && window.__e2e__) {
    window.__e2e__.setPoolAddress(CONTRACTS.PRIVACY_POOL_ADDRESS);
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
