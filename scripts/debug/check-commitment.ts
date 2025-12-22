import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { CONTRACTS } from "../frontend/src/config/contracts";

async function main() {
  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  const depositAmount = await privacyPool.DEPOSIT_AMOUNT();
  const playwrightSecret = BigInt("0x8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91");

  // Calculate using contract
  const contractCommitment = await privacyPool.calculateCommitment(
    playwrightSecret,
    depositAmount
  );

  console.log("Contract calculateCommitment:", contractCommitment);

  // Calculate using circomlibjs
  const poseidon = await buildPoseidon();
  const hash = poseidon([playwrightSecret, BigInt(depositAmount.toString())]);
  const jsCommitment = "0x" + poseidon.F.toString(hash).padStart(64, '0');

  console.log("JS/Poseidon calculated:     ", jsCommitment);
  console.log("Match:", contractCommitment.toLowerCase() === jsCommitment.toLowerCase());

  // Check deposited commitment
  const filter = privacyPool.filters.Deposit();
  const events = await privacyPool.queryFilter(filter);
  if (events.length > 0) {
    console.log("\nActual deposited commitment:", events[0].args?.commitment);
    console.log("Match with contract calc:", events[0].args?.commitment.toLowerCase() === contractCommitment.toLowerCase());
    console.log("Match with JS calc:", events[0].args?.commitment.toLowerCase() === jsCommitment.toLowerCase());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
