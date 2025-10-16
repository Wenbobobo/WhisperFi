"use client";
import React from "react";

type Props = {
  onGenerateProof: (note: string) => Promise<void>;
  onSubmit: () => Promise<void> | void;
  loading?: boolean;
  disabled?: boolean;
};

export function WithdrawForm({ onGenerateProof, onSubmit, loading, disabled }: Props) {
  const [note, setNote] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);

  const handleGenerate = async () => {
    setMessage(null);
    if (!note) {
      setMessage("Please enter your note.");
      return;
    }
    try {
      await onGenerateProof(note);
      setMessage("Proof generated.");
    } catch (e: any) {
      setMessage(e?.message || "Proof generation failed");
    }
  };

  const handleSubmit = async () => {
    setMessage(null);
    try {
      await onSubmit();
      setMessage("Withdrawal submitted.");
    } catch (e: any) {
      setMessage(e?.message || "Submit failed");
    }
  };

  return (
    <div data-testid="withdraw-form">
      <label htmlFor="note">Private Note</label>
      <input
        id="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="private-defi-<secret>-<nullifier>-v1"
      />
      <div>
        <button onClick={handleGenerate} disabled={disabled || loading}>
          {loading ? "Generating..." : "Generate Proof"}
        </button>
        <button onClick={handleSubmit} disabled={disabled}>
          Submit Withdrawal
        </button>
      </div>
      {message && <div role="status">{message}</div>}
    </div>
  );
}

export default WithdrawForm;
