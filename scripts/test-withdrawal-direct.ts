import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../frontend/src/abi/PrivacyPool.json";

async function main() {
  console.log("\n🧪 Direct Withdrawal Test (No UI)\n");
  console.log("=".repeat(70));

  // PLAYWRIGHT test credentials
  const secret = BigInt("0x8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91");
  const amount = BigInt("100000000000000000");
  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

  console.log("🔐 Test Parameters:");
  console.log(`  Secret: ${secret.toString()}`);
  console.log(`  Amount: ${ethers.formatEther(amount)} ETH`);

  // Get contract using Contract constructor with explicit ABI
  const [signer] = await ethers.getSigners();
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    signer
  );

  // Get deposits
  const filter = privacyPool.filters.Deposit();
  const events = await privacyPool.queryFilter(filter);
  console.log(`\n📊 Found ${events.length} deposit(s)`);

  if (events.length === 0) {
    throw new Error("No deposits found!");
  }

  const commitments = events.map((e: any) => e.args.commitment);
  const leafIndex = 0; // First deposit

  console.log(`  Using deposit at index ${leafIndex}: ${commitments[leafIndex]}`);

  // Build Merkle tree
  const poseidon = await buildPoseidon();

  class SimpleMerkleTree {
    private zeros: bigint[] = [];
    private levelNodes: Map<number, bigint>[] = [];
    private root: bigint = 0n;

    constructor(private levels: number, leaves: string[], zeroValue: string, private poseidon: any) {
      this.levelNodes = Array.from({ length: levels + 1 }, () => new Map());
      let currentZero = BigInt(zeroValue);
      for (let i = 0; i < levels; i++) {
        this.zeros[i] = currentZero;
        currentZero = this.hash(currentZero, currentZero);
      }
      this.root = currentZero;
      leaves.forEach((leaf, idx) => this.insertLeaf(BigInt(leaf), idx));
    }

    private hash(left: bigint, right: bigint): bigint {
      return BigInt(this.poseidon.F.toString(this.poseidon([left, right])));
    }

    private insertLeaf(leaf: bigint, index: number): void {
      this.levelNodes[0].set(index, leaf);
      let currentIndex = index;
      let currentHash = leaf;
      for (let level = 0; level < this.levels; level++) {
        const isRight = currentIndex % 2 === 1;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
        const sibling = this.levelNodes[level].get(siblingIndex) ?? this.zeros[level];
        const left = isRight ? sibling : currentHash;
        const right = isRight ? currentHash : sibling;
        currentHash = this.hash(left, right);
        const parentIndex = Math.floor(currentIndex / 2);
        this.levelNodes[level + 1].set(parentIndex, currentHash);
        currentIndex = parentIndex;
      }
      this.root = currentHash;
    }

    getRoot(): string {
      return "0x" + this.root.toString(16).padStart(64, "0");
    }

    getProof(index: number): { pathElements: string[]; pathIndices: number[] } {
      const pathElements: string[] = [];
      const pathIndices: number[] = [];
      let currentIndex = index;
      for (let level = 0; level < this.levels; level++) {
        const siblingIndex = currentIndex ^ 1;
        const sibling = this.levelNodes[level].get(siblingIndex) ?? this.zeros[level];
        pathElements.push("0x" + sibling.toString(16).padStart(64, "0"));
        pathIndices.push(currentIndex % 2);
        currentIndex = Math.floor(currentIndex / 2);
      }
      return { pathElements, pathIndices };
    }
  }

  const tree = new SimpleMerkleTree(16, commitments, ZERO_VALUE, poseidon);
  const merkleRoot = tree.getRoot();
  const { pathElements, pathIndices } = tree.getProof(leafIndex);

  console.log(`\n🌳 Merkle Root: ${merkleRoot}`);

  const contractRoot = await privacyPool.merkleRoot();
  console.log(`  Contract Root: ${contractRoot}`);
  console.log(`  Match: ${merkleRoot.toLowerCase() === contractRoot.toLowerCase() ? "✅" : "❌"}`);

  // Calculate nullifier
  const nullifierHash = poseidon([secret, 0n]);
  const nullifier = "0x" + poseidon.F.toObject(nullifierHash).toString(16).padStart(64, '0');
  console.log(`\n🔑 Nullifier: ${nullifier}`);

  // Generate proof
  console.log(`\n⚙️  Generating ZK Proof...`);
  const circuitInput = {
    secret: secret.toString(),
    amount: amount.toString(),
    pathElements: pathElements.map(p => BigInt(p).toString()),
    pathIndices: pathIndices
  };

  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    "frontend/public/zk/withdraw.wasm",
    "frontend/public/zk/withdraw.zkey"
  );

  console.log(`  ✅ Proof generated!`);
  console.log(`  Public signal: ${publicSignals[0]}`);

  // Format proof for contract - convert to BigInt to ensure proper type
  console.log(`\n🔍 Raw proof values:`);
  console.log(`  pi_a:`, proof.pi_a);
  console.log(`  pi_b:`, proof.pi_b);
  console.log(`  pi_c:`, proof.pi_c);

  const proofA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const proofB = [
    [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
    [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])],
  ];
  const proofC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

  console.log(`\n🔍 Converted proof values:`);
  console.log(`  proofA:`, proofA);
  console.log(`  proofB:`, proofB);
  console.log(`  proofC:`, proofC);

  // Check for any invalid values
  const allValues = [...proofA, ...proofB[0], ...proofB[1], ...proofC];
  const hasInvalid = allValues.some(v => typeof v !== 'bigint' || v < 0n);
  console.log(`  All values valid: ${!hasInvalid ? "✅" : "❌"}`);

  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  console.log(`\n📤 Submitting Withdrawal...`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  Nullifier: ${nullifier}`);

  // FIRST: Try static call to see if parameters are valid
  console.log(`\n🔍 Testing with staticCall first...`);
  try {
    await privacyPool.withdraw.staticCall(
      proofA,
      proofB,
      proofC,
      merkleRoot,
      nullifier,
      recipient,
      fee,
      relayer
    );
    console.log(`  ✅ Static call succeeded! Parameters are valid.`);
  } catch (staticError: any) {
    console.log(`  ⚠️  Static call failed: ${staticError.message}`);
    if (staticError.message.includes("Invalid proof")) {
      console.log(`  Note: This is expected - proof may be invalid for test data`);
    } else if (!staticError.message.includes("function selector")) {
      console.log(`  But function was recognized - this is good!`);
    }
  }

  console.log(`\n📤 Now sending actual transaction...`);
  try {
    const tx = await privacyPool.withdraw(
      proofA,
      proofB,
      proofC,
      merkleRoot,
      nullifier,
      recipient,
      fee,
      relayer
    );

    console.log(`  📝 Transaction: ${tx.hash}`);
    console.log(`  ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`  ⛽ Gas used: ${receipt.gasUsed.toString()}`);

    console.log(`\n🎉 SUCCESS! Withdrawal completed successfully!`);
    console.log("=".repeat(70));

  } catch (error: any) {
    console.log(`\n❌ Transaction Failed:`);
    console.log(`  Error: ${error.message}`);
    if (error.data) {
      console.log(`  Data: ${error.data}`);
    }
    console.log("=".repeat(70));
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
