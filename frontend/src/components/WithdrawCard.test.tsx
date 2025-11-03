import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const flowMocks = {
  generateProof: vi.fn().mockResolvedValue({
    proof: { pi_a: [1n, 2n], pi_b: [[3n, 4n], [5n, 6n]], pi_c: [7n, 8n] },
    publicSignals: ["1", "2"],
  }),
  submitWithdrawal: vi.fn().mockResolvedValue({ hash: "0xhash" }),
};

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1111111111111111111111111111111111111111",
    chain: { blockExplorers: { default: { url: "https://explorer" } } },
  }),
  usePublicClient: () => ({ getLogs: vi.fn() }),
  useWriteContract: () => ({
    data: undefined,
    writeContract: vi.fn().mockResolvedValue("0xhash"),
    isPending: false,
    error: undefined,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
    error: undefined,
  }),
}));

vi.mock("../lib/withdraw/flow", () => ({
  createWithdrawFlow: () => flowMocks,
}));

vi.mock("../utils/crypto", () => ({
  parseNote: (note: string) => ({ secret: "123", nullifier: "456" }),
  generateCommitment: vi.fn().mockResolvedValue("0xcommitment"),
  generateNullifierHash: vi.fn().mockResolvedValue("0xnullifier"),
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
    await waitFor(() =>
      expect(
        screen.getByText(/Proof generated successfully/i)
      ).toBeInTheDocument()
    );
    expect(flowMocks.generateProof).toHaveBeenCalledWith("private-defi-a-b-v1");
  });
});
