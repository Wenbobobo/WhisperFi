import { ethers } from "hardhat";
import { CONTRACTS } from "../frontend/src/config/contracts";
import {
  PLAYWRIGHT_NOTE_SECRET,
  PLAYWRIGHT_USER,
  PLAYWRIGHT_RELAYER,
  HARDHAT_RPC_URL,
} from "../playwright/constants/e2e";

async function main() {
  const [deployer] = await ethers.getSigners();
  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    deployer
  );

  const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
  const secretValue = BigInt(PLAYWRIGHT_NOTE_SECRET);
  const commitment = await privacyPool.calculateCommitment(
    secretValue,
    depositAmount
  );

  const userFundingTx = await deployer.sendTransaction({
    to: PLAYWRIGHT_USER.address,
    value: ethers.parseEther("1"),
  });
  await userFundingTx.wait();

  const tx = await privacyPool.deposit(commitment, { value: depositAmount });
  await tx.wait();

  const merkleRoot = await privacyPool.merkleRoot();
  const relayerBalance = await ethers.provider.getBalance(
    PLAYWRIGHT_RELAYER.address
  );

  console.log(
    JSON.stringify({
      merkleRoot,
      commitment,
      depositAmount: depositAmount.toString(),
      relayerBalance: relayerBalance.toString(),
      rpcUrl: HARDHAT_RPC_URL,
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

