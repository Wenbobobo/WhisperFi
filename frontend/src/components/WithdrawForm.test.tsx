import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import WithdrawForm from "./WithdrawForm";

describe("WithdrawForm", () => {
  it("validates empty note and shows message", async () => {
    const onGen = vi.fn().mockResolvedValue(undefined);
    const onSub = vi.fn();
    const Harness = () => {
      const [note, setNote] = useState("");
      return (
        <WithdrawForm
          note={note}
          onNoteChange={setNote}
          recipient=""
          onRecipientChange={vi.fn()}
          relayer=""
          onRelayerChange={vi.fn()}
          fee=""
          onFeeChange={vi.fn()}
          onGenerateProof={onGen}
          onSubmit={onSub}
        />
      );
    };
    render(<Harness />);
    const genBtns = screen.getAllByText(/Generate Proof/i);
    genBtns[0].click();
    expect(await screen.findByRole("status")).toHaveTextContent(
      /Please enter your note\./i
    );
    expect(onGen).not.toHaveBeenCalled();
  });

  it("calls onGenerateProof with provided note", async () => {
    const onGen = vi.fn().mockResolvedValue(undefined);
    const onSub = vi.fn();
    const Harness = () => {
      const [note, setNote] = useState("");
      return (
        <WithdrawForm
          note={note}
          onNoteChange={setNote}
          recipient=""
          onRecipientChange={vi.fn()}
          relayer=""
          onRelayerChange={vi.fn()}
          fee=""
          onFeeChange={vi.fn()}
          onGenerateProof={onGen}
          onSubmit={onSub}
        />
      );
    };
    render(<Harness />);
    const forms = screen.getAllByTestId("withdraw-form");
    const form = forms[0] as HTMLElement;
    const input = within(form).getByLabelText(/Private Note/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "private-defi-a-b-v1" } });
    const genBtn = within(form).getByText(/Generate Proof/i);
    genBtn.click();
    await waitFor(() => {
      expect(onGen).toHaveBeenCalledWith("private-defi-a-b-v1");
    });
  });
});
