import { ethers } from "ethers";

export type Groth16Proof = {
  pi_a: [bigint | string, bigint | string];
  pi_b: [[bigint | string, bigint | string], [bigint | string, bigint | string]];
  pi_c: [bigint | string, bigint | string];
};

export function normalizeProof(proof: Groth16Proof) {
  return {
    a: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
    b: [
      [proof.pi_b[0][0].toString(), proof.pi_b[0][1].toString()],
      [proof.pi_b[1][0].toString(), proof.pi_b[1][1].toString()],
    ],
    c: [proof.pi_c[0].toString(), proof.pi_c[1].toString()],
  } as const;
}

export function toWithdrawArgs(
  proof: Groth16Proof,
  publicSignals: (string | bigint)[],
  recipient: `0x${string}`,
  fee: bigint,
  relayer: `0x${string}`,
  merkleRoot?: string | bigint,
  nullifierHash?: string | bigint
) {
  const formatted = normalizeProof(proof);
  // If merkleRoot and nullifierHash are provided explicitly, use them
  // Otherwise fall back to extracting from publicSignals (legacy behavior)
  const rootBytes32 = merkleRoot
    ? ethers.toBeHex(BigInt(merkleRoot as any), 32)
    : ethers.toBeHex(BigInt(publicSignals[0] as any), 32);
  const nullifierBytes32 = nullifierHash
    ? ethers.toBeHex(BigInt(nullifierHash as any), 32)
    : ethers.toBeHex(BigInt(publicSignals[1] as any), 32);
  return [
    formatted.a,
    formatted.b,
    formatted.c,
    rootBytes32,
    nullifierBytes32,
    recipient,
    fee,
    relayer,
  ] as const;
}

