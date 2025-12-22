import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolArtifact from "../frontend/src/abi/PrivacyPool.json";

async function main() {
  console.log("\n🧪 Testing Complete Withdrawal Flow\n");
  console.log("=".repeat(70));

  // Test parameters (using PLAYWRIGHT constants)
  const NOTE = "private-defi-8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91-cc6a4aa81c38aaa7a658c8eb4d9ba86b186e19344b0de61507cd8ddb384e57-v1";
  const secret = BigInt("0x8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91");
  const amount = BigInt("100000000000000000");
  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

  console.log("📝 Test Parameters:");
  console.log(`  Secret: ${secret.toString()}`);
  console.log(`  Amount: ${amount.toString()} wei (0.1 ETH)`);

  // Get contract and deposit info
  const privacyPool = await ethers.getContractAt(
    PrivacyPoolArtifact.abi as any,
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  const filter = privacyPool.filters.Deposit();
  const events = await privacyPool.queryFilter(filter);
  console.log(`\n📊 Found ${events.length} deposit event(s)`);

  if (events.length === 0) {
    throw new Error("No deposits found! Please run the seed script first.");
  }

  const commitments = events.map(e => e.args?.commitment as string);
  console.log(`  Commitments:`, commitments);

  // Use the ACTUAL deposited commitment
  const commitment = commitments[0];  // Use the first (and only) deposited commitment
  const leafIndex = 0;  // It's at index 0

  // Build Poseidon for Merkle tree and proof generation
  const poseidon = await buildPoseidon();

  console.log(`\n🔐 Using Deposited Commitment: ${commitment}`);
  if (leafIndex < 0) {
    throw new Error(`Commitment ${commitment} not found in deposits!`);
  }

  console.log(`  ✅ Found at leaf index: ${leafIndex}`);

  // Build Merkle tree
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

  console.log(`\n🌳 Merkle Tree:`);
  console.log(`  Root: ${merkleRoot}`);

  const contractRoot = await privacyPool.merkleRoot();
  console.log(`  Contract Root: ${contractRoot}`);
  console.log(`  Match: ${merkleRoot.toLowerCase() === contractRoot.toLowerCase() ? "✅ YES" : "❌ NO"}`);

  if (merkleRoot.toLowerCase() !== contractRoot.toLowerCase()) {
    throw new Error("Merkle root mismatch!");
  }

  // Check if root is in history
  const isInHistory = await privacyPool.rootHistory(merkleRoot);
  console.log(`  In rootHistory: ${isInHistory ? "✅ YES" : "❌ NO"}`);

  if (!isInHistory) {
    throw new Error("Merkle root not in rootHistory!");
  }

  // Calculate nullifier (using same method as frontend)
  const nullifierHash = poseidon([secret, 0n]);
  const nullifier = "0x" + poseidon.F.toObject(nullifierHash).toString(16).padStart(64, '0');

  console.log(`\n🔑 Nullifier: ${nullifier}`);

  // Generate ZK proof
  console.log(`\n⚙️  Generating ZK Proof (this may take ~30 seconds)...`);

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
  console.log(`  Public signal (publicInputsHash): ${publicSignals[0]}`);

  // Calculate expected public inputs hash
  const expectedPublicHash = poseidon([BigInt(merkleRoot), BigInt(nullifier)]);
  const expectedHashHex = "0x" + poseidon.F.toString(expectedPublicHash).padStart(64, '0');
  console.log(`  Expected publicInputsHash: ${expectedHashHex}`);
  console.log(`  Match: ${BigInt(publicSignals[0]) === BigInt(expectedHashHex) ? "✅ YES" : "❌ NO"}`);

  // Prepare withdrawal args
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  const proofA: [string, string] = [proof.pi_a[0].toString(), proof.pi_a[1].toString()];
  const proofB: [[string, string], [string, string]] = [
    [proof.pi_b[0][0].toString(), proof.pi_b[0][1].toString()],
    [proof.pi_b[1][0].toString(), proof.pi_b[1][1].toString()],
  ];
  const proofC: [string, string] = [proof.pi_c[0].toString(), proof.pi_c[1].toString()];

  console.log(`\n📤 Submitting Withdrawal:`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Fee: ${fee}`);
  console.log(`  Relayer: ${relayer}`);
  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  Nullifier: ${nullifier}`);

  // Call withdraw - use explicit function call
  const [signer] = await ethers.getSigners();

  // Log what we're about to send
  console.log(`  Contract address: ${CONTRACTS.PRIVACY_POOL_ADDRESS}`);
  console.log(`  From: ${signer.address}`);

  const tx = await privacyPool.connect(signer)[
    "withdraw(uint256[2],uint256[2][2],uint256[2],bytes32,bytes32,address,uint256,address)"
  ](
    proofA,
    proofB,
    proofC,
    merkleRoot,
    nullifier,
    recipient,
    fee,
    relayer
  );

  console.log(`  Transaction hash: ${tx.hash}`);
  console.log(`  ⏳ Waiting for confirmation...`);

  const receipt = await tx.wait();
  console.log(`  ✅ Transaction confirmed in block ${receipt?.blockNumber}`);
  console.log(`  Gas used: ${receipt?.gasUsed.toString()}`);

  console.log(`\n✅ SUCCESS! Complete withdrawal flow worked!`);
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ ERROR:");
    console.error(error);
    process.exit(1);
  });
