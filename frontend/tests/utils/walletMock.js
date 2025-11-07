(() => {
  const accounts = ['0x6daF4CdAf9f1D07316A632D330231eF15A686C3E'];
  const chainId = '0x7a69';
  const balance = '0x3635C9ADC5DEA00000';
  const listeners = {};

  const connectionUid = 'json-rpc.0';
  const persistedStore = {
    state: {
      chainId: 31337,
      current: connectionUid,
      connections: {
        __type: 'Map',
        value: [
          [
            connectionUid,
            {
              accounts: [{ address: accounts[0], type: 'json-rpc' }],
              chainId: 31337,
              connector: {
                id: 'injected',
                name: 'Injected (mock)',
                type: 'injected',
                uid: connectionUid,
              },
            },
          ],
        ],
      },
    },
    version: 2,
  };

  try {
    window.localStorage.setItem('wagmi.store', JSON.stringify(persistedStore));
  } catch (err) {
    console.warn('Failed to preset wagmi.store', err);
  }

  const notifyConnection = () => {
    try {
      window.__e2e__?.updateConnectionState?.({
        isConnected: true,
        chainId: parseInt(chainId, 16),
      });
    } catch (err) {
      console.warn('Failed to update connection state', err);
    }
    if (typeof listeners.accountsChanged === 'function') {
      listeners.accountsChanged(accounts);
    }
    if (typeof listeners.chainChanged === 'function') {
      listeners.chainChanged(chainId);
    }
    if (typeof listeners.connect === 'function') {
      listeners.connect({ chainId });
    }
  };

  window.ethereum = {
    isMetaMask: true,
    isConnected: () => true,
    request: async ({ method }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          try {
            window.__e2e__ = window.__e2e__ || {};
            window.__e2e__.mockAccount = accounts[0];
            window.dispatchEvent(
              new CustomEvent('e2e:mock-account', { detail: accounts[0] })
            );
          } catch (err) {
            console.warn('Failed to broadcast mock account', err);
          }
          notifyConnection();
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
