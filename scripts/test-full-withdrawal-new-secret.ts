import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🧪 Full Withdrawal Test with NEW Secret\n");
  console.log("=".repeat(70));

  // Use the SAME values that worked in test-different-proof.ts
  const secret = BigInt("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  const amount = BigInt("50000000000000000"); // 0.05 ETH (this worked before!)
  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

  console.log(`🔐 Secret: ${secret.toString()}`);
  console.log(`💰 Amount: ${ethers.formatEther(amount)} ETH`);

  const [signer, recipient] = await ethers.getSigners();
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    signer
  );

  // Calculate commitment
  const poseidon = await buildPoseidon();
  const commitmentHash = poseidon([secret, amount]);
  const commitment = "0x" + poseidon.F.toObject(commitmentHash).toString(16).padStart(64, '0');

  console.log(`\n📝 Commitment: ${commitment}`);

  // Make deposit
  console.log(`\n💸 Making deposit...`);
  const depositTx = await privacyPool.deposit(commitment, { value: amount });
  await depositTx.wait();
  console.log(`✅ Deposit successful!`);

  // Build Merkle tree
  const filter = privacyPool.filters.Deposit();
  const events = await privacyPool.queryFilter(filter);
  const commitments = events.map((e: any) => e.args.commitment);
  const leafIndex = commitments.findIndex((c: string) => c.toLowerCase() === commitment.toLowerCase());

  console.log(`\n🌳 Building Merkle tree...`);
  console.log(`  Total deposits: ${commitments.length}`);
  console.log(`  Our deposit index: ${leafIndex}`);

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

  const contractRoot = await privacyPool.merkleRoot();
  console.log(`  Computed root: ${merkleRoot}`);
  console.log(`  Contract root: ${contractRoot}`);
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

  console.log(`✅ Proof generated!`);

  // Format proof
  const proofA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
  const proofB = [
    [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
    [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])],
  ];
  const proofC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

  const recipientAddress = await recipient.getAddress();
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  console.log(`\n📤 Submitting Withdrawal...`);
  console.log(`  Recipient: ${recipientAddress}`);

  try {
    const tx = await privacyPool.withdraw(
      proofA,
      proofB,
      proofC,
      merkleRoot,
      nullifier,
      recipientAddress,
      fee,
      relayer
    );

    console.log(`  📝 Transaction: ${tx.hash}`);
    console.log(`  ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`  ✅ Confirmed in block ${receipt?.blockNumber}`);
    console.log(`  ⛽ Gas used: ${receipt?.gasUsed.toString()}`);

    console.log(`\n🎉 SUCCESS! Withdrawal completed successfully!`);
    console.log("=".repeat(70));

  } catch (error: any) {
    console.log(`\n❌ Transaction Failed:`);
    console.log(`  Error: ${error.message}`);
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
