(() => {
  const accounts = ['0x1111111111111111111111111111111111111111'];
  const chainId = '0x7a69';
  const balance = '0x56BC75E2D63100000';
  const listeners = {};

  try {
    window.localStorage.setItem(
      'wagmi.store',
      JSON.stringify({
        state: {
          connections: {
            connections: [
              {
                account: { type: 'json-rpc', address: accounts[0] },
                chainId: 31337,
                connectorId: 'injected',
              },
            ],
          },
          current: {
            account: { type: 'json-rpc', address: accounts[0] },
            chainId: 31337,
            connectorId: 'injected',
          },
        },
      })
    );
  } catch (err) {
    console.warn('Failed to preset wagmi.store', err);
  }

  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return accounts;
        case 'eth_chainId':
          return chainId;
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain':
          return null;
        case 'eth_getBalance':
          return balance;
        default:
          return null;
      }
    },
    on: (event, handler) => {
      listeners[event] = handler;
    },
    removeListener: (event) => {
      delete listeners[event];
    },
  };
})();
