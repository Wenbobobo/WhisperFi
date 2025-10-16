import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

// Mock wagmi hooks used by component
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", chain: { blockExplorers: { default: { url: "https://explorer" } } } }),
  usePublicClient: () => ({
    getLogs: vi.fn().mockResolvedValue([
      { args: { commitment: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" } },
    ]),
  }),
  useWriteContract: () => ({ data: undefined, writeContract: vi.fn(), isPending: false, error: undefined }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false, error: undefined }),
}));

// Mock crypto utilities used during proof generation
vi.mock("../utils/crypto", () => ({
  parseNote: (note: string) => ({ secret: "123" }),
  generateCommitment: vi.fn().mockResolvedValue("0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"),
  generateNullifierHash: vi.fn().mockResolvedValue("0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"),
  CircuitCompatibleMerkleTree: class {
    depth: number; leaves: string[]; zero: string;
    constructor(depth: number, leaves: string[], zero: string) { this.depth = depth; this.leaves = leaves; this.zero = zero; }
    async initialize() { return; }
    generateProof(index: number) { return { pathElements: new Array(16).fill(0n), pathIndices: new Array(16).fill(0) }; }
    getRoot() { return "0xroot"; }
  },
}));

// Mock zk proof helpers
vi.mock("../lib/zk/withdraw", () => ({
  buildWithdrawInputs: vi.fn().mockResolvedValue({
    secret: 1n,
    amount: 100000000000000000n,
    pathElements: new Array(16).fill(0n),
    pathIndices: new Array(16).fill(0),
    merkleRoot: 1n,
    nullifier: 2n,
  }),
  generateWithdrawProof: vi.fn().mockResolvedValue({
    proof: {
      pi_a: [1n, 2n],
      pi_b: [ [3n, 4n], [5n, 6n] ],
      pi_c: [7n, 8n],
    },
    publicSignals: ["1", "2"],
  }),
}));

import WithdrawCard from "./WithdrawCard";

describe("WithdrawCard", () => {
  it("generates a proof and shows success feedback", async () => {
    render(<WithdrawCard />);
    // Find the embedded form
    const form = screen.getByTestId("withdraw-form");
    const input = within(form).getByLabelText(/Private Note/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "private-defi-a-b-v1" } });
    const genBtn = within(form).getByText(/Generate Proof/i);
    genBtn.click();
    // Expect success message after mocked proof generation
    await waitFor(() => expect(screen.getByText(/Proof generated successfully/i)).toBeInTheDocument());
  });
});

