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
