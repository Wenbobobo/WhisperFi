import { ethers } from "ethers";
import { CircuitCompatibleMerkleTree, generateNullifierHash } from "../../utils/crypto";
import { buildWithdrawInputs, WithdrawCircuitInput } from "./withdraw";

export type MerkleInputs = {
  pathElements: (string | bigint)[];
  pathIndices: number[];
  root: string;
};

/**
 * Build circuit inputs and auxiliary values for a withdraw proof using on-chain commitments.
 */
export async function buildWithdrawCircuitInputs(
  secretHex: string,
  amountWei: string,
  commitments: string[],
  leafIndex: number,
  zeroValue: string,
  depth = 16
): Promise<{ input: WithdrawCircuitInput; merkle: MerkleInputs; nullifierHex: string }>
{
  const tree = new CircuitCompatibleMerkleTree(depth, commitments, zeroValue);
  await tree.initialize();
  const { pathElements, pathIndices } = tree.generateProof(leafIndex);
  const merkleRoot = tree.getRoot();

  const nullifierHex = await generateNullifierHash(secretHex);

  const input = await buildWithdrawInputs(
    secretHex,
    amountWei,
    { pathElements, pathIndices, root: merkleRoot },
    nullifierHex
  );

  return { input, merkle: { pathElements, pathIndices, root: merkleRoot }, nullifierHex };
}

