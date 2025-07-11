// frontend/src/utils/crypto.ts
import { ethers } from 'ethers';
import { buildPoseidon } from 'circomlibjs';

// 全局 poseidon 实例
let poseidonInstance: any = null;

// 初始化 Poseidon 哈希函数
async function initializePoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

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
  const parts = note.split('-');
  if (parts.length !== 5 || parts[0] !== 'private' || parts[1] !== 'defi') {
    throw new Error('Invalid note format. Expected format: private-defi-<secret>-<nullifier>-v1');
  }
  return {
    secret: '0x' + parts[2],
    nullifier: '0x' + parts[3],
  };
}

/**
 * Generates a commitment for a deposit.
 * The commitment is the Poseidon hash of the secret and amount (to match circuit).
 * @param secret The secret from the note.
 * @param amount The deposit amount in wei (BigInt or string).
 * @returns The commitment hash as a hex string.
 */
export async function generateCommitment(secret: string, amount: bigint | string): Promise<string> {
  const poseidon = await initializePoseidon();
  const hash = poseidon([secret, amount]);
  // Convert the field element to a BigInt, then to hex
  const hashBigInt = BigInt(poseidon.F.toString(hash));
  return '0x' + hashBigInt.toString(16).padStart(64, '0');
}

/**
 * Generates the nullifier hash for a withdrawal.
 * According to the circuit, the nullifier is Poseidon(secret).
 * @param secret The secret from the note.
 * @returns The nullifier hash as a hex string.
 */
export async function generateNullifierHash(secret: string): Promise<string> {
  const poseidon = await initializePoseidon();
  const hash = poseidon([secret]);
  // Convert the field element to a BigInt, then to hex
  const hashBigInt = BigInt(poseidon.F.toString(hash));
  return '0x' + hashBigInt.toString(16).padStart(64, '0');
}
