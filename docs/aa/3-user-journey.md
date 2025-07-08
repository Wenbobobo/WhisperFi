# AA Knowledge Base: Part 3

## The User Journey: A Hybrid Approach

Now that we have a solid understanding of the ERC-4337 standard, let's take a closer look at the user journey in the context of our new hybrid model. This will help us to understand how we can use AA to enhance the user experience of our protocol, while still providing the security and privacy of our core relayer-based model.

### 1. Onboarding

-   **Standard EOA:** The user starts with a standard EOA, such as MetaMask. This is the wallet they will use to interact with our protocol.
-   **Smart Contract Wallet (Optional):** The user has the option to create a new Smart Contract Wallet. This can be done at any time, and it will give them access to the full benefits of AA for their other on-chain activities.

### 2. Depositing Funds

-   The user deposits funds into our privacy pool from their EOA. This is a standard transaction that is visible on-chain.
-   The user's funds are now held in the privacy pool, and they are associated with a private note that is only known to the user.

### 3. Executing a Trade

-   **High-Value, Sensitive Trades:** For high-value, sensitive trades, the user will use our core relayer-based model. This will ensure that their transaction is protected from MEV and that their privacy is preserved.
-   **Low-Value, Non-Sensitive Trades:** For low-value, non-sensitive trades, the user can use our AA-based model. This will give them the flexibility to interact with any DeFi protocol, without needing to worry about the gas costs or the complexities of the underlying transaction.

### 4. Withdrawing Funds

-   The user can withdraw their funds from the privacy pool to any address they choose. This can be their original EOA, a new EOA, or a Smart Contract Wallet.

### The Hybrid Model in Action

Let's take a look at an example of how the hybrid model would work in practice:

1.  A user deposits 10 ETH into our privacy pool from their MetaMask wallet.
2.  The user wants to make a large, sensitive trade on Uniswap. They use our core relayer-based model to execute the trade. The transaction is sent directly to a block builder, and the user's privacy is preserved.
3.  The user now has 5 ETH remaining in the privacy pool. They want to use this to provide liquidity to a new, unaudited DeFi protocol. They use our AA-based model to create a new, temporary Smart Contract Wallet. They then withdraw their 5 ETH to this new wallet and use it to interact with the DeFi protocol.

This hybrid model gives our users the best of both worlds: the security and privacy of our core relayer-based model, and the flexibility and composability of the AA model.
