import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { CONTRACTS } from "../frontend/src/config/contracts";

// Copy of CircuitCompatibleMerkleTree from frontend
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

  generateProof(leafIndex: number): { pathElements: string[]; pathIndices: number[] } {
    if (leafIndex >= this.leafCount) {
      throw new Error(`Leaf index ${leafIndex} is out of bounds`);
    }

    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    let index = leafIndex;

    for (let level = 0; level < this.levels; level++) {
      const siblingIndex = index ^ 1;
      const siblingValue =
        this.levelNodes[level].get(siblingIndex) ?? this.zeros[level];
      pathElements.push(this.toHex(siblingValue));
      pathIndices.push(index % 2);
      index = Math.floor(index / 2);
    }

    return { pathElements, pathIndices };
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
  console.log("\n🌳 Testing Frontend Merkle Tree Implementation\n");
  console.log("=" .repeat(60));

  // Use the actual commitment that was deposited (from contract event)
  const commitment = "0x2d478fbfd59044a3aa39bd0be0693d04f4912ae98ad998158be75e06c4b6d47d";

  console.log("🔐 Using Actual Deposited Commitment:", commitment);

  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

  const tree = new CircuitCompatibleMerkleTree(16, [commitment], ZERO_VALUE);
  await tree.initialize();

  const calculatedRoot = tree.getRoot();
  console.log("\n✅ Calculated Root (from frontend logic):", calculatedRoot);

  const privacyPool = await ethers.getContractAt(
    "PrivacyPool",
    CONTRACTS.PRIVACY_POOL_ADDRESS
  );

  const contractRoot = await privacyPool.merkleRoot();
  console.log("📋 Contract Root:                       ", contractRoot);
  console.log("🔍 Match:", calculatedRoot.toLowerCase() === contractRoot.toLowerCase() ? "✅ YES" : "❌ NO");

  if (calculatedRoot.toLowerCase() === contractRoot.toLowerCase()) {
    console.log("\n✅ SUCCESS! Frontend Merkle tree matches contract!");

    const { pathElements, pathIndices } = tree.generateProof(0);
    console.log("\n📤 Merkle Proof for leaf 0:");
    console.log("  pathElements:", JSON.stringify(pathElements.slice(0, 3)), "...");
    console.log("  pathIndices:", JSON.stringify(pathIndices.slice(0, 3)), "...");
  }

  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
