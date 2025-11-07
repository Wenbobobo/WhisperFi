import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWithdrawFlow } from "./flow";

const CONTRACT_ADDRESS = "0x000000000000000000000000000000000000dead";

describe("withdraw flow helpers", () => {
  const publicClient = {
    getLogs: vi.fn(),
  };

  const parseNote = vi.fn();
  const generateCommitment = vi.fn();
  const generateNullifierHash = vi.fn();
  const buildInputs = vi.fn();
  const generateProof = vi.fn();
  const toArgs = vi.fn();

  const writeContract = vi.fn();
  const loadCommitments = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setup() {
    return createWithdrawFlow({
      contractAddress: CONTRACT_ADDRESS,
      publicClient: publicClient as any,
      parseNote,
      generateCommitment,
      generateNullifierHash,
      buildCircuitInputs: buildInputs,
      generateWithdrawProof: generateProof,
      toWithdrawArgs: toArgs,
      writeContract,
      loadCommitments,
    });
  }

  it("builds proof from note and commitment logs", async () => {
    parseNote.mockReturnValue({ secret: "0x123", nullifier: "0x456" });
    const commitment = "0xccc";
    generateCommitment.mockResolvedValue(commitment);
    generateNullifierHash.mockResolvedValue("0xnnn");
    const mockTime = 1_725_000_000_000;
    loadCommitments.mockResolvedValue({
      commitments: [commitment, "0xother"],
      commitmentCount: 2,
      lastSyncedAt: mockTime,
      expiresAt: mockTime + 1_800_000,
    });
    buildInputs.mockResolvedValue({
      input: { secret: 1n },
      merkle: { root: "0xroot" },
      nullifierHex: "0xnnn",
    });
    generateProof.mockResolvedValue({
      proof: { pi_a: [1n, 2n], pi_b: [[3n, 4n], [5n, 6n]], pi_c: [7n, 8n] },
      publicSignals: ["1", "2"],
    });

    const flow = setup();
    const result = await flow.generateProof("note-1");

    expect(parseNote).toHaveBeenCalledWith("note-1");
    expect(generateCommitment).toHaveBeenCalledWith("0x123", expect.any(String));
    expect(loadCommitments).toHaveBeenCalledWith(
      expect.objectContaining({ address: CONTRACT_ADDRESS })
    );
    expect(buildInputs).toHaveBeenCalled();
    expect(generateProof).toHaveBeenCalledWith(expect.objectContaining({ secret: 1n }));
    expect(result).toMatchObject({
      proof: expect.any(Object),
      publicSignals: expect.any(Array),
      merkle: expect.any(Object),
      nullifierHex: "0xnnn",
      cacheInfo: {
        lastSyncedAt: mockTime,
        expiresAt: mockTime + 1_800_000,
        commitmentCount: 2,
      },
    });
  });

  it("throws when commitment not found in logs", async () => {
    parseNote.mockReturnValue({ secret: "0x123", nullifier: "0x456" });
    generateCommitment.mockResolvedValue("0xccc");
    loadCommitments.mockResolvedValue({
      commitments: ["0xddd"],
      commitmentCount: 1,
      lastSyncedAt: Date.now(),
    });

    const flow = setup();

    await expect(flow.generateProof("note-2")).rejects.toThrow(
      /commitment was not found/i
    );
  });

  it("uses mocked proof when __e2e__ supplies one", async () => {
    parseNote.mockReturnValue({ secret: "0x123", nullifier: "0x456" });
    const commitment = "0xccc";
    generateCommitment.mockResolvedValue(commitment);
    generateNullifierHash.mockResolvedValue("0xnnn");
    loadCommitments.mockResolvedValue({
      commitments: [commitment],
      commitmentCount: 1,
      lastSyncedAt: Date.now(),
    });
    buildInputs.mockResolvedValue({
      input: { secret: 1n },
      merkle: { root: "0xroot" },
      nullifierHex: "0xnnn",
    });
    generateProof.mockResolvedValue({
      proof: { shouldNot: "be used" },
      publicSignals: ["1", "2"],
    });

    (window as any).__e2e__ = {
      mockProof: {
        proof: { stub: true },
        publicSignals: ["stubbed"],
      },
    };

    const flow = setup();
    const result = await flow.generateProof("note-stubbed");

    expect(result.proof).toEqual({ stub: true });
    expect(result.publicSignals).toEqual(["stubbed"]);
    expect(generateProof).not.toHaveBeenCalled();
    delete (window as any).__e2e__;
  });

  it("submits withdrawal using prepared proof arguments", async () => {
    toArgs.mockReturnValue(["args"]);
    writeContract.mockResolvedValue({ hash: "0xhash" });

    const flow = setup();
    const fee = 5n;
    const relayer = "0x5678123412341234123412341234123412341234" as const;
    const response = await flow.submitWithdrawal({
      proof: {},
      publicSignals: [],
      recipient: "0x1234",
      fee,
      relayer,
      account: "0xabc",
      chain: { id: 1 },
    });

    expect(toArgs).toHaveBeenCalledWith({}, [], "0x1234", fee, relayer);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACT_ADDRESS,
        functionName: "withdraw",
        args: ["args"],
        account: "0xabc",
        chain: { id: 1 },
      })
    );
    expect(response.hash).toBe("0xhash");
  });
});
