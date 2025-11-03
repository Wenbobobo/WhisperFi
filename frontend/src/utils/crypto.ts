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
  // Remove "0x" prefix if present before converting to BigInt
  const secretValue = secret.startsWith("0x") ? secret : "0x" + secret;
  const hash = poseidon([BigInt(secretValue), BigInt(amount)]);
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
  // Use Poseidon(2) with zero padding to mirror on-chain 2-ary hasher
  const hash = poseidon([BigInt(secret), 0n]);
  return "0x" + poseidon.F.toObject(hash).toString(16).padStart(64, "0");
}

/**
 * Circuit-compatible Merkle Tree implementation that matches withdraw.circom exactly.
 * This implementation ensures perfect compatibility with the ZK circuit's MerkleTreeChecker template.
 */
export class CircuitCompatibleMerkleTree {
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

  /**
   * Initialise the Merkle tree using the same incremental hashing logic as the contract.
   */
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

  async verifyProof(
    leaf: string,
    pathElements: string[],
    pathIndices: number[],
    expectedRoot: string
  ): Promise<boolean> {
    if (!this.poseidon) {
      this.poseidon = await buildPoseidon();
    }

    let currentHash = this.toBigInt(leaf);

    for (let i = 0; i < pathElements.length; i++) {
      const sibling = this.toBigInt(pathElements[i]);
      const isRight = pathIndices[i] === 1;
      const left = isRight ? sibling : currentHash;
      const right = isRight ? currentHash : sibling;
      currentHash = this.hashPair(left, right);
    }

    return this.toHex(currentHash) === expectedRoot;
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
