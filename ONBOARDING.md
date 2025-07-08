# Onboarding Guide

Welcome to the Private DeFi project. This document provides a high-level overview of the project and instructions on how to get started.

## 1. Project Overview

The goal of this project is to build a privacy-preserving protocol for DeFi. The protocol will allow users to execute transactions on DeFi protocols without revealing their identity or their trading strategies. The core of the protocol is a relayer-based system that uses Zero-Knowledge proofs to ensure the privacy and security of user transactions.

## 2. Project Structure

The project is organized into the following directories:

-   `circuits`: Contains the ZK circuits for the protocol. **Note:** This directory currently contains some unnecessary files that should be ignored.
-   `contracts`: Contains the smart contracts for the protocol.
-   `docs`: Contains the documentation for the project.
-   `relayer`: Contains the off-chain relayer component.
-   `scripts`: Contains scripts for compiling circuits and deploying contracts.
-   `test`: Contains the tests for the smart contracts.

## 3. Getting Started

To get started with the project, you will need to have the following installed:

-   Node.js
-   npm
-   Hardhat
-   Circom

Once you have these installed, you can run the following commands to set up the project:

```
npm install
npx hardhat compile
npx hardhat test
```

## 4. Key Documents

-   `PROJECT_PLAN.md`: The main tracking document for the project.
-   `TECHNICAL_ARCHITECTURE.md`: A detailed blueprint for the protocol.
-   `Pre research.txt`: The product specification document.
-   `docs/zk/`: A series of documents explaining the ZK concepts used in the protocol.
-   `docs/aa/`: A series of documents explaining the Account Abstraction concepts used in the protocol.
