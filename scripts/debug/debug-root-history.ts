import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { CONTRACTS } from "../frontend/src/config/contracts";

class CircuitCompatibleMerkleTree {
  private readonly levels: number;
  private readonly zeroValue: string;
  private readonly leafCount: number;
  private readonly pendingLeaves: string[];
  private poseidon: any;
  private zeros: bigint[] = [];
  private levelNodes: Map<number, bigint>[] = [];
  private nextIndex = 0;
  private root: bigint = 0n;

  constructor(levels: number, leaves: string[], zeroValue: string = "0") {
    this.levels = levels;
    this.zeroValue = zeroValue;
    this.leafCount = leaves.length;
    this.pendingLeaves = [...leaves];
  }

  async initialize(): Promise<void> {
    this.poseidon = await buildPoseidon();

    this.zeros = new Array(this.levels);
    this.levelNodes = Array.from(
      { length: this.levels + 1 },
      () => new Map<number, bigint>()
    );

    let currentZero = this.toBigInt(this.zeroValue);
    for (let level = 0; level < this.levels; level++) {
      this.zeros[level] = currentZero;
      currentZero = this.hashPair(currentZero, currentZero);
    }

    this.root = currentZero;

    for (const leaf of this.pendingLeaves) {
      this.insertLeaf(this.toBigInt(leaf));
    }
  }

  getRoot(): string {
    return this.toHex(this.root);
  }

  private hashPair(left: bigint, right: bigint): bigint {
    const output = this.poseidon([left, right]);
    return BigInt(this.poseidon.F.toObject(output));
  }

  private insertLeaf(leaf: bigint): void {
    this.levelNodes[0].set(this.nextIndex, leaf);
    let currentIndex = this.nextIndex;
    let currentHash = leaf;

    for (let level = 0; level < this.levels; level++) {
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      const siblingValue =
        this.levelNodes[level].get(siblingIndex) ?? this.zeros[level];

      const left = isRightNode ? siblingValue : currentHash;
      const right = isRightNode ? currentHash : siblingValue;
      currentHash = this.hashPair(left, right);

      const parentIndex = Math.floor(currentIndex / 2);
      this.levelNodes[level + 1].set(parentIndex, currentHash);
      currentIndex = parentIndex;
    }

    this.root = currentHash;
    this.nextIndex += 1;
  }

  private toBigInt(value: string | bigint): bigint {
    if (typeof value === "bigint") {
      return value;
    }
    if (value.startsWith("0x") || value.startsWith("0X")) {
      return BigInt(value);
    }
    return BigInt(value);
  }

  private toHex(value: bigint): string {
    return "0x" + value.toString(16).padStart(64, "0");
  }
}

async function main() {
  console.log("\n🔍 Debugging Root History Issue\n");
  console.log("=".repeat(60));

  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";
  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  // Get all deposit events
  const filter = privacyPool.filters.Deposit();
  const events = await privacyPool.queryFilter(filter);

  console.log(`\n📊 Found ${events.length} deposit event(s):`);
  const commitments: string[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const commitment = event.args?.commitment;
    commitments.push(commitment);
    console.log(`  [${i}] ${commitment}`);
  }

  // Get current contract root
  const currentRoot = await privacyPool.merkleRoot();
  console.log(`\n🌳 Current Contract Root: ${currentRoot}`);

  // Calculate root using frontend logic
  const tree = new CircuitCompatibleMerkleTree(16, commitments, ZERO_VALUE);
  await tree.initialize();
  const calculatedRoot = tree.getRoot();
  console.log(`📐 Frontend Calculated Root: ${calculatedRoot}`);
  console.log(`   Match: ${calculatedRoot.toLowerCase() === currentRoot.toLowerCase() ? "✅ YES" : "❌ NO"}`);

  // Check if calculated root is in rootHistory
  const isInHistory = await privacyPool.rootHistory(calculatedRoot);
  console.log(`\n📖 Is calculated root in rootHistory? ${isInHistory ? "✅ YES" : "❌ NO"}`);

  // Try to check if current root is in history
  const isCurrentInHistory = await privacyPool.rootHistory(currentRoot);
  console.log(`📖 Is current root in rootHistory? ${isCurrentInHistory ? "✅ YES" : "❌ NO"}`);

  // Get nextLeafIndex
  const nextLeafIndex = await privacyPool.nextLeafIndex();
  console.log(`\n📍 Next Leaf Index: ${nextLeafIndex}`);

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
