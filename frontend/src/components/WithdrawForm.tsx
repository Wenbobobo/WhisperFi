"use client";
import React from "react";

type Props = {
  note: string;
  onNoteChange: (value: string) => void;
  recipient: string;
  onRecipientChange: (value: string) => void;
  relayer: string;
  onRelayerChange: (value: string) => void;
  fee: string;
  onFeeChange: (value: string) => void;
  onGenerateProof: (note: string) => Promise<void>;
  onSubmit: () => Promise<void> | void;
  loading?: boolean;
  disabled?: boolean;
};

export function WithdrawForm({
  note,
  onNoteChange,
  recipient,
  onRecipientChange,
  relayer,
  onRelayerChange,
  fee,
  onFeeChange,
  onGenerateProof,
  onSubmit,
  loading,
  disabled,
}: Props) {
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
    <div data-testid="withdraw-form" className="space-y-3">
      <div className="space-y-1">
        <label className="block text-sm text-gray-300" htmlFor="note">
          Private Note
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="private-defi-<secret>-<nullifier>-v1"
          className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm text-gray-300" htmlFor="recipient">
          Recipient Address
        </label>
        <input
          id="recipient"
          value={recipient}
          onChange={(e) => onRecipientChange(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm text-gray-300" htmlFor="relayer">
          Relayer Address
        </label>
        <input
          id="relayer"
          value={relayer}
          onChange={(e) => onRelayerChange(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm text-gray-300" htmlFor="fee">
          Relayer Fee (ETH)
        </label>
        <input
          id="fee"
          value={fee}
          onChange={(e) => onFeeChange(e.target.value)}
          placeholder="0.001"
          className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={disabled || loading}
          className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold py-2 transition-colors"
        >
          {loading ? "Generating..." : "Generate Proof"}
        </button>
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-900 text-white font-semibold py-2 transition-colors"
        >
          Submit Withdrawal
        </button>
      </div>

      {message && (
        <div role="status" className="text-sm text-gray-300">
          {message}
        </div>
      )}
    </div>
  );
}

export default WithdrawForm;
