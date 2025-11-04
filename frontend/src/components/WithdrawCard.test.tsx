import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const flowMocks = {
  generateProof: vi.fn().mockResolvedValue({
    proof: { pi_a: [1n, 2n], pi_b: [[3n, 4n], [5n, 6n]], pi_c: [7n, 8n] },
    publicSignals: ["1", "2"],
    cacheInfo: {
      lastSyncedAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000,
      commitmentCount: 3,
    },
  }),
  submitWithdrawal: vi.fn().mockResolvedValue({ hash: "0xhash" }),
};

const loadCommitmentsMock = vi.fn();
const clearCommitmentMock = vi.fn();
const getStatusMock = vi.fn();
const syncMock = {
  publish: vi.fn(),
  subscribe: vi.fn().mockReturnValue(() => {}),
  getSourceId: () => "test",
};

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
    getStatus: getStatusMock,
  }),
}));

vi.mock("../lib/withdraw/cacheSync", () => ({
  getCacheSync: () => syncMock,
}));

vi.mock("../lib/withdraw/localCache", () => ({
  createLocalStoragePersistor: () => ({
    load: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
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
  beforeEach(() => {
    flowMocks.generateProof.mockClear();
    flowMocks.submitWithdrawal.mockClear();
    loadCommitmentsMock.mockReset();
    clearCommitmentMock.mockReset();
    getStatusMock.mockReset();
    syncMock.publish.mockClear();
    syncMock.subscribe.mockClear();
  });

  it("generates a proof, allows cache reset, and shows feedback messages", async () => {
    render(<WithdrawCard />);
    const form = screen.getByTestId("withdraw-form");
    const input = within(form).getByLabelText(/Private Note/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "private-defi-a-b-v1" } });
    fireEvent.click(within(form).getByText(/Generate Proof/i));

    await waitFor(() =>
      expect(
        screen.getByText(/Proof generated successfully/i)
      ).toBeInTheDocument()
    );
    expect(flowMocks.generateProof).toHaveBeenCalledWith("private-defi-a-b-v1");

    const resetButton = screen.getByRole("button", { name: /reset commitment cache/i });
    fireEvent.click(resetButton);

    await waitFor(() =>
      expect(
        screen.getByText(/Commitment cache cleared/i)
      ).toBeInTheDocument()
    );
    expect(clearCommitmentMock).toHaveBeenCalled();
  });

  it("shows cache status information when available", async () => {
    vi.useFakeTimers();
    const now = new Date("2025-11-04T00:00:00Z").getTime();
    vi.setSystemTime(now);

    getStatusMock.mockReturnValue({
      lastSyncedAt: now - 5 * 60 * 1000,
      expiresAt: now + 25 * 60 * 1000,
      commitmentCount: 42,
    });

    render(<WithdrawCard />);

    expect(
      screen.getByText(/Cache last synced/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Expires around/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/42 commitments cached/i)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
