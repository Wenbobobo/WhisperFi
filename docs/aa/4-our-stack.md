# AA Knowledge Base: Part 4

## Our Stack: A Hybrid Approach to Privacy

As we have discussed in the previous documents, we have decided to adopt a hybrid approach to our protocol, using both a relayer-based model and the AA model to provide a comprehensive privacy solution. This document will provide a high-level overview of our proposed architecture, and how we plan to use both of these models to provide a seamless and secure user experience.

### The Core: A Relayer-Based Privacy Pool

The core of our protocol is a relayer-based privacy pool. This is a system where users can deposit their funds into a smart contract, and then use a relayer to execute transactions on their behalf. The relayer is a trusted, centralized agent that is responsible for submitting transactions to the blockchain in a way that protects the user's privacy and prevents MEV.

This model provides the highest level of security and privacy for our users, as it allows us to use private order flow to send transactions directly to block builders. This means that our users' transactions are never exposed to the public mempool, where they would be vulnerable to MEV and other attacks.

### The Feature Layer: Account Abstraction

On top of our core privacy pool, we will build a feature layer that uses Account Abstraction to enhance the user experience. This will allow us to provide our users with the following features:

- **Gas Sponsorship:** We will use a Paymaster to sponsor gas fees for our users. This will allow them to interact with our protocol without needing to have ETH in their wallet.
- **Flexible Withdrawals:** We will allow users to withdraw funds from our privacy pool directly to a new Smart Contract Wallet. This will give them access to the full benefits of AA for their other on-chain activities.
- **Simplified Onboarding:** We will use AA to create a more seamless onboarding experience for new users. For example, we could create a Smart Contract Wallet for each new user automatically, and then use a Paymaster to sponsor their first few transactions.

### The Hybrid Model in Action

Here is an example of how the hybrid model would work in practice:

1.  A user deposits 10 ETH into our privacy pool from their MetaMask wallet.
2.  The user wants to make a large, sensitive trade on Uniswap. They use our core relayer-based model to execute the trade. The transaction is sent directly to a block builder, and the user's privacy is preserved.
3.  The user now has 5 ETH remaining in the privacy pool. They want to use this to provide liquidity to a new, unaudited DeFi protocol. They use our AA-based model to create a new, temporary Smart Contract Wallet. They then withdraw their 5 ETH to this new wallet and use it to interact with the DeFi protocol.

This hybrid model gives our users the best of both worlds: the security and privacy of our core relayer-based model, and the flexibility and composability of the AA model.
