import { groth16 } from "snarkjs";
import { buildPoseidon } from "circomlibjs";

export type MerkleProof = {
  pathElements: (bigint | string)[];
  pathIndices: number[];
  root: string | bigint;
};

export type WithdrawCircuitInput = {
  secret: bigint;
  amount: bigint;
  pathElements: bigint[];
  pathIndices: number[];
  merkleRoot: bigint;
  nullifier: bigint;
};

export async function buildWithdrawInputs(
  secretHex: string,
  amountWei: string,
  proof: MerkleProof,
  nullifierHex: string
): Promise<WithdrawCircuitInput> {
  const secret = BigInt(secretHex);
  const amount = BigInt(amountWei);
  const merkleRoot = BigInt(proof.root as any);
  // Force bigint array
  const pathElements = proof.pathElements.map((el) => BigInt(el as any));
  const pathIndices = proof.pathIndices;
  const nullifier = BigInt(nullifierHex);

  return { secret, amount, pathElements, pathIndices, merkleRoot, nullifier };
}

export async function generateWithdrawProof(
  input: WithdrawCircuitInput,
  wasmUrl: string,
  zkeyUrl: string
) {
  // Delegate to snarkjs
  return groth16.fullProve(input as any, wasmUrl, zkeyUrl);
}

export async function poseidon2(inputs: [bigint, bigint]): Promise<bigint> {
  const p = await buildPoseidon();
  const out = p(inputs);
  // Normalise return type to bigint
  return BigInt(p.F.toObject(out));
}

