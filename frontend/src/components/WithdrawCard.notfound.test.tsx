import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const flowMocks = {
  generateProof: vi
    .fn()
    .mockRejectedValue(new Error("Your deposit commitment was not found in the Merkle tree.")),
  submitWithdrawal: vi.fn(),
};

const loadCommitmentsMock = vi.fn();
const clearCommitmentMock = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1111111111111111111111111111111111111111",
    chain: { id: 1, blockExplorers: { default: { url: "https://explorer" } } },
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

vi.mock("../lib/withdraw/logSource", () => ({
  createResettableDepositLogLoader: () => ({
    loadCommitments: loadCommitmentsMock,
    clear: clearCommitmentMock,
  }),
}));

vi.mock("../lib/withdraw/localCache", () => ({
  createLocalStoragePersistor: () => ({
    load: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

vi.mock("../utils/crypto", () => ({
  parseNote: (note: string) => ({ secret: "123", nullifier: "456" }),
  generateCommitment: vi.fn(),
  generateNullifierHash: vi.fn(),
}));

vi.mock("../lib/withdraw/flow", () => ({
  createWithdrawFlow: () => flowMocks,
}));

import WithdrawCard from "./WithdrawCard";

describe("WithdrawCard negative states - commitment not found", () => {
  beforeEach(() => {
    flowMocks.generateProof.mockClear();
    clearCommitmentMock.mockReset();
    loadCommitmentsMock.mockReset();
  });

  it("suggests resetting cache when commitment is missing", async () => {
    render(<WithdrawCard />);
    const form = screen.getByTestId("withdraw-form");
    const input = within(form).getByLabelText(/Private Note/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "private-defi-a-b-v1" } });
    fireEvent.click(within(form).getByText(/Generate Proof/i));

    await waitFor(() =>
      expect(
        screen.getByText(/Try resetting the commitment cache/i)
      ).toBeInTheDocument()
    );

    const resetButton = screen.getByRole("button", { name: /reset commitment cache/i });
    fireEvent.click(resetButton);

    await waitFor(() =>
      expect(
        screen.getByText(/Commitment cache cleared/i)
      ).toBeInTheDocument()
    );
    expect(clearCommitmentMock).toHaveBeenCalled();
  });
});
