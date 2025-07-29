// frontend/src/utils/crypto.ts
import { ethers } from "ethers";
import { buildPoseidon } from "circomlibjs";

/**
 * Generates a new random note.
 * A note consists of a secret and a nullifier, both 31-byte random hex strings.
 * The format is `private-defi-secret-nullifier-version`
 * @returns A new note string.
 */
export function generateNote(): string {
  const secret = ethers.hexlify(ethers.randomBytes(31));
  const nullifier = ethers.hexlify(ethers.randomBytes(31));
  return `private-defi-${secret.slice(2)}-${nullifier.slice(2)}-v1`;
}

/**
 * Parses a note to extract the secret and nullifier.
 * @param note The note string to parse.
 * @returns An object containing the secret and nullifier.
 */
export function parseNote(note: string): { secret: string; nullifier: string } {
  const parts = note.split("-");
  if (parts.length !== 5 || parts[0] !== "private" || parts[1] !== "defi") {
    throw new Error(
      "Invalid note format. Expected format: private-defi-<secret>-<nullifier>-v1"
    );
  }
  return {
    secret: "0x" + parts[2],
    nullifier: "0x" + parts[3],
  };
}

/**
 * Generates a commitment for a deposit, matching the circuit's and contract's logic.
 * The commitment is the Poseidon hash of the secret and amount.
 * This matches the ZK circuit design: poseidon([secret, amount])
 * @param secret The secret from the note.
 * @param amount The deposit amount (typically 0.1 ETH = 100000000000000000 wei).
 * @returns The commitment hash as a hex string.
 */
export async function generateCommitment(
  secret: string,
  amount: string
): Promise<string> {
  const poseidon = await buildPoseidon();
  // Ensure inputs are converted to BigInt, which is expected by circomlibjs
  const hash = poseidon([BigInt(secret), BigInt(amount)]);
  // Convert the poseidon field element to hex string format expected by ethers
  return "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
}

/**
 * Generates the nullifier hash for a withdrawal, matching the circuit's logic.
 * The nullifier hash is the Poseidon hash of the secret only.
 * This matches the ZK circuit design: poseidon([secret])
 * @param secret The secret from the note.
 * @returns The nullifier hash as a hex string.
 */
export async function generateNullifierHash(secret: string): Promise<string> {
  const poseidon = await buildPoseidon();
  // Hash only the secret to generate the nullifier hash, matching circuit logic
  const hash = poseidon([BigInt(secret)]);
  // Convert the poseidon field element to hex string format expected by ethers
  return "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
}

/**
 * Circuit-compatible Merkle Tree implementation that matches withdraw.circom exactly.
 * This implementation ensures perfect compatibility with the ZK circuit's MerkleTreeChecker template.
 */
export class CircuitCompatibleMerkleTree {
  private levels: number;
  private zeroValue: string;
  private poseidon: any;
  private leaves: string[];
  private tree: string[][];

  constructor(levels: number, leaves: string[], zeroValue: string = "0") {
    this.levels = levels;
    this.zeroValue = zeroValue;
    this.leaves = [...leaves];
    this.tree = [];
  }

  /**
   * Initialize the tree with Poseidon hasher.
   * Must be called before using other methods.
   */
  async initialize(): Promise<void> {
    this.poseidon = await buildPoseidon();
    await this.buildTree();
  }

  /**
   * Build the complete Merkle tree using circuit-compatible hashing.
   */
  private async buildTree(): Promise<void> {
    // Initialize the tree with empty arrays for each level
    this.tree = Array.from({ length: this.levels + 1 }, () => []);
    
    // Set leaves at level 0
    this.tree[0] = [...this.leaves];
    
    // Pad leaves to the next power of 2 if needed
    const maxLeaves = Math.pow(2, this.levels);
    while (this.tree[0].length < maxLeaves) {
      this.tree[0].push(this.zeroValue);
    }

    // Build tree bottom-up
    for (let level = 1; level <= this.levels; level++) {
      const currentLevel = this.tree[level];
      const previousLevel = this.tree[level - 1];
      
      for (let i = 0; i < previousLevel.length; i += 2) {
        const left = previousLevel[i];
        const right = previousLevel[i + 1] || this.zeroValue;
        
        // Use the same hashing logic as the circuit: poseidon([left, right])
        const hash = this.poseidon([BigInt(left), BigInt(right)]);
        const hashStr = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
        currentLevel.push(hashStr);
      }
    }
  }

  /**
   * Get the Merkle root (top of the tree).
   */
  getRoot(): string {
    if (!this.tree || this.tree.length === 0) {
      throw new Error("Tree not initialized. Call initialize() first.");
    }
    return this.tree[this.levels][0];
  }

  /**
   * Generate Merkle proof for a specific leaf, compatible with circuit format.
   * Returns pathElements and pathIndices that match the circuit's expectations.
   */
  generateProof(leafIndex: number): { pathElements: string[]; pathIndices: number[] } {
    if (!this.tree || this.tree.length === 0) {
      throw new Error("Tree not initialized. Call initialize() first.");
    }

    if (leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} is out of bounds`);
    }

    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    let currentIndex = leafIndex;

    // Generate path from leaf to root
    for (let level = 0; level < this.levels; level++) {
      const isLeft = currentIndex % 2 === 0;
      const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
      
      // Get sibling element (or zero if it doesn't exist)
      const sibling = this.tree[level][siblingIndex] || this.zeroValue;
      pathElements.push(sibling);
      
      // Path index: 0 = current node is left, 1 = current node is right
      pathIndices.push(isLeft ? 0 : 1);
      
      // Move to parent index
      currentIndex = Math.floor(currentIndex / 2);
    }

    return { pathElements, pathIndices };
  }

  /**
   * Verify a Merkle proof manually (for testing).
   * This uses the same logic as the circuit's MerkleTreeChecker.
   */
  async verifyProof(
    leaf: string,
    pathElements: string[],
    pathIndices: number[],
    expectedRoot: string
  ): Promise<boolean> {
    let currentHash = leaf;

    for (let i = 0; i < pathElements.length; i++) {
      const sibling = pathElements[i];
      const isLeft = pathIndices[i] === 0;
      
      // Same logic as circuit: if pathIndices[i] = 0, current is left, sibling is right
      const left = isLeft ? currentHash : sibling;
      const right = isLeft ? sibling : currentHash;
      
      const hash = this.poseidon([BigInt(left), BigInt(right)]);
      currentHash = "0x" + this.poseidon.F.toObject(hash).toString(16).padStart(64, "0");
    }

    return currentHash === expectedRoot;
  }
}
