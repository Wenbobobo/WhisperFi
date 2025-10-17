import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", chain: { blockExplorers: { default: { url: "https://explorer" } } } }),
  usePublicClient: () => ({
    getLogs: vi.fn().mockResolvedValue([
      { args: { commitment: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" } },
    ]),
  }),
  useWriteContract: () => ({ data: undefined, writeContract: vi.fn(), isPending: false, error: undefined }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false, error: undefined }),
}));

vi.mock("../utils/crypto", () => ({
  parseNote: (note: string) => ({ secret: "123" }),
  // return a different commitment so it won't be found in the logs
  generateCommitment: vi.fn().mockResolvedValue("0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"),
  generateNullifierHash: vi.fn().mockResolvedValue("0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"),
  CircuitCompatibleMerkleTree: class {},
}));

vi.mock("../lib/zk/withdraw", () => ({
  buildWithdrawInputs: vi.fn(),
  generateWithdrawProof: vi.fn(),
}));

import WithdrawCard from "./WithdrawCard";

describe("WithdrawCard negative states - commitment not found", () => {
  it("shows error when commitment is not found in the tree", async () => {
    render(<WithdrawCard />);
    const form = screen.getByTestId("withdraw-form");
    const input = within(form).getByLabelText(/Private Note/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "private-defi-a-b-v1" } });
    const genBtn = within(form).getByText(/Generate Proof/i);
    genBtn.click();
    await waitFor(() => expect(screen.getByText(/was not found in the Merkle tree/i)).toBeInTheDocument());
  });
});

