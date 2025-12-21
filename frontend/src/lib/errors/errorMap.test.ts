import { describe, it, expect, beforeEach } from "vitest";
import {
  ErrorType,
  ContractErrorCode,
  ZkErrorCode,
  RpcErrorCode,
  ValidationErrorCode,
  getErrorMessage,
  getErrorMessageWithCode,
  parseError,
  isErrorType,
  isErrorCode,
  setErrorLocale,
  getErrorLocale,
  getLocalizedError,
} from "./errorMap";

describe("errorMap", () => {
  beforeEach(() => {
    // Reset locale before each test
    setErrorLocale("en");
  });

  describe("parseError", () => {
    it("should parse string errors", () => {
      const result = parseError("Invalid proof");
      expect(result.type).toBe(ErrorType.CONTRACT_REVERT);
      expect(result.code).toBe(ContractErrorCode.INVALID_PROOF);
    });

    it("should parse Error objects", () => {
      const error = new Error("Nullifier has been used");
      const result = parseError(error);
      expect(result.type).toBe(ErrorType.CONTRACT_REVERT);
      expect(result.code).toBe(ContractErrorCode.NULLIFIER_ALREADY_USED);
    });

    it("should handle null and undefined", () => {
      expect(parseError(null).type).toBe(ErrorType.UNKNOWN);
      expect(parseError(undefined).type).toBe(ErrorType.UNKNOWN);
    });

    it("should parse object with message property", () => {
      const error = { message: "user rejected transaction" };
      const result = parseError(error);
      expect(result.type).toBe(ErrorType.RPC_ERROR);
      expect(result.code).toBe(RpcErrorCode.USER_REJECTED);
    });
  });

  describe("getErrorMessage - Contract Revert Errors", () => {
    it("should map InvalidProof error", () => {
      const message = getErrorMessage("InvalidProof");
      expect(message).toBe("Invalid proof. Please regenerate the proof and try again.");
    });

    it("should map NullifierAlreadyUsed error", () => {
      const message = getErrorMessage("NullifierAlreadyUsed");
      expect(message).toBe("This note has already been used for withdrawal.");
    });

    it("should map 'Nullifier has been used' revert string", () => {
      const message = getErrorMessage(new Error("Nullifier has been used"));
      expect(message).toBe("This note has already been used for withdrawal.");
    });

    it("should map InvalidRoot error", () => {
      const message = getErrorMessage("InvalidRoot");
      expect(message).toBe("Invalid Merkle root. Please refresh and try again.");
    });

    it("should map InsufficientFee error", () => {
      const message = getErrorMessage("InsufficientFee");
      expect(message).toBe("Insufficient fee provided for the transaction.");
    });

    it("should map InvalidMerkleRoot error", () => {
      const message = getErrorMessage("Invalid Merkle root");
      expect(message).toBe("Invalid Merkle root. The proof may be outdated. Please regenerate.");
    });

    it("should map FeeExceedsDeposit error", () => {
      const message = getErrorMessage("Fee exceeds deposit");
      expect(message).toBe("The relayer fee exceeds the deposit amount.");
    });

    it("should map MerkleTreeFull error", () => {
      const message = getErrorMessage("Merkle tree is full");
      expect(message).toBe("The privacy pool is full. Please try again later.");
    });

    it("should map ReentrancyGuard error", () => {
      const message = getErrorMessage("ReentrancyGuard: reentrant call");
      expect(message).toBe("Transaction rejected due to reentrancy protection.");
    });

    it("should map trade execution failed error", () => {
      const message = getErrorMessage("Trade execution failed");
      expect(message).toBe("Trade execution failed. Please verify trade parameters.");
    });

    it("should map invalid trade data hash error", () => {
      const message = getErrorMessage("Invalid trade data hash");
      expect(message).toBe("Invalid trade data hash. The trade parameters may have been tampered.");
    });
  });

  describe("getErrorMessage - ZK Errors", () => {
    it("should map WasmLoadFailed error", () => {
      const message = getErrorMessage("Failed to fetch wasm file");
      expect(message).toBe("Failed to load ZK circuit. Please refresh the page and try again.");
    });

    it("should map ZkeyLoadFailed error", () => {
      const message = getErrorMessage("Could not load zkey file");
      expect(message).toBe("Failed to load proving key. Please check your connection and try again.");
    });

    it("should map ProofGenerationFailed error", () => {
      const message = getErrorMessage("groth16 prove failed");
      expect(message).toBe("Proof generation failed. Please verify your note and try again.");
    });

    it("should map CommitmentNotFound error", () => {
      const message = getErrorMessage("Your deposit commitment was not found in the Merkle tree");
      expect(message).toBe("Your deposit commitment was not found in the Merkle tree. Try resetting the cache.");
    });

    it("should map NoDepositsFound error", () => {
      const message = getErrorMessage("No deposit events found");
      expect(message).toBe("No deposit events found. The pool is empty.");
    });

    it("should map circuit error", () => {
      const message = getErrorMessage("circom error occurred");
      expect(message).toBe("Circuit computation error. Please try again.");
    });

    it("should map invalid witness error", () => {
      const message = getErrorMessage("Invalid witness data provided");
      expect(message).toBe("Invalid witness data. Please ensure your note is correct.");
    });
  });

  describe("getErrorMessage - RPC Errors", () => {
    it("should map NetworkError", () => {
      const message = getErrorMessage("network error occurred");
      expect(message).toBe("Network error. Please check your internet connection.");
    });

    it("should map TimeoutError", () => {
      const message = getErrorMessage("request timed out");
      expect(message).toBe("Request timed out. Please try again.");
    });

    it("should map InsufficientFunds", () => {
      const message = getErrorMessage("insufficient funds for transaction");
      expect(message).toBe("Insufficient funds in wallet. Please add more ETH.");
    });

    it("should map UserRejected", () => {
      const message = getErrorMessage("user rejected the transaction");
      expect(message).toBe("Transaction was rejected by user.");
    });

    it("should map ChainMismatch", () => {
      const message = getErrorMessage("wrong chain connected");
      expect(message).toBe("Wrong network. Please switch to the correct network.");
    });

    it("should map WalletNotConnected", () => {
      const message = getErrorMessage("wallet not connected");
      expect(message).toBe("Wallet not connected. Please connect your wallet first.");
    });

    it("should map GasEstimationFailed", () => {
      const message = getErrorMessage("cannot estimate gas for transaction");
      expect(message).toBe("Gas estimation failed. The transaction may fail.");
    });

    it("should map NonceTooLow", () => {
      const message = getErrorMessage("nonce too low");
      expect(message).toBe("Transaction nonce too low. Please try again.");
    });

    it("should map ReplacementUnderpriced", () => {
      const message = getErrorMessage("replacement transaction underpriced");
      expect(message).toBe("Replacement transaction underpriced. Please increase gas price.");
    });
  });

  describe("getErrorMessage - Validation Errors", () => {
    it("should map InvalidNoteFormat", () => {
      const message = getErrorMessage("invalid note format");
      expect(message).toBe("Invalid note format. Please check your note.");
    });

    it("should map InvalidRecipientAddress", () => {
      const message = getErrorMessage("invalid recipient address");
      expect(message).toBe("Invalid recipient address. Please enter a valid Ethereum address.");
    });

    it("should map EmptyNote", () => {
      const message = getErrorMessage("Please enter your note");
      expect(message).toBe("Please enter your note.");
    });
  });

  describe("getErrorMessage - Unknown Errors", () => {
    it("should return generic message for unknown error", () => {
      const message = getErrorMessage("some random error that doesn't match");
      expect(message).toBe("An unexpected error occurred. Please try again.");
    });

    it("should return generic RPC message for transaction reverts", () => {
      const message = getErrorMessage("execution reverted with some unknown reason");
      expect(message).toBe("Transaction failed. Please try again.");
    });

    it("should return generic ZK message for proof-related errors", () => {
      const message = getErrorMessage("some proof related error occurred");
      expect(message).toBe("Zero-knowledge proof error. Please try again.");
    });

    it("should return generic RPC message for network-related errors", () => {
      const message = getErrorMessage("rpc call failed with some error");
      expect(message).toBe("Network communication error. Please try again.");
    });
  });

  describe("getErrorMessage - i18n Support (Chinese)", () => {
    it("should return Chinese message for InvalidProof", () => {
      const message = getErrorMessage("InvalidProof", "zh");
      expect(message).toBe("证明无效。请重新生成证明后再试。");
    });

    it("should return Chinese message for NullifierAlreadyUsed", () => {
      const message = getErrorMessage("NullifierAlreadyUsed", "zh");
      expect(message).toBe("此凭证已被使用进行提款。");
    });

    it("should return Chinese message for network error", () => {
      const message = getErrorMessage("network error", "zh");
      expect(message).toBe("网络错误。请检查您的互联网连接。");
    });

    it("should return Chinese message for user rejected", () => {
      const message = getErrorMessage("user rejected", "zh");
      expect(message).toBe("交易被用户拒绝。");
    });

    it("should return Chinese generic message for unknown error", () => {
      const message = getErrorMessage("random unknown error", "zh");
      expect(message).toBe("发生意外错误。请重试。");
    });
  });

  describe("getErrorMessage - Nested Errors", () => {
    it("should extract message from nested error with cause", () => {
      const innerError = new Error("Nullifier has been used");
      const outerError = new Error("Transaction failed");
      (outerError as Error & { cause: Error }).cause = innerError;

      const message = getErrorMessage(outerError);
      expect(message).toBe("This note has already been used for withdrawal.");
    });

    it("should extract message from error with data property", () => {
      const error = {
        message: "Transaction reverted",
        data: { message: "Invalid proof" },
      };

      const result = parseError(error);
      expect(result.code).toBe(ContractErrorCode.INVALID_PROOF);
    });

    it("should extract message from error with reason property", () => {
      const error = {
        message: "Call exception",
        reason: "Nullifier has been used",
      };

      const message = getErrorMessage(error);
      expect(message).toBe("This note has already been used for withdrawal.");
    });

    it("should extract message from error with shortMessage property", () => {
      const error = {
        message: "Some long message",
        shortMessage: "user denied transaction",
      };

      const message = getErrorMessage(error);
      expect(message).toBe("Transaction was rejected by user.");
    });
  });

  describe("getErrorMessageWithCode", () => {
    it("should return message with code and type", () => {
      const result = getErrorMessageWithCode("InvalidProof");
      expect(result.message).toBe("Invalid proof. Please regenerate the proof and try again.");
      expect(result.code).toBe(ContractErrorCode.INVALID_PROOF);
      expect(result.type).toBe(ErrorType.CONTRACT_REVERT);
    });

    it("should return correct locale message", () => {
      const result = getErrorMessageWithCode("InvalidProof", "zh");
      expect(result.message).toBe("证明无效。请重新生成证明后再试。");
    });
  });

  describe("isErrorType", () => {
    it("should correctly identify CONTRACT_REVERT type", () => {
      expect(isErrorType("Invalid proof", ErrorType.CONTRACT_REVERT)).toBe(true);
      expect(isErrorType("Invalid proof", ErrorType.ZK_ERROR)).toBe(false);
    });

    it("should correctly identify ZK_ERROR type", () => {
      expect(isErrorType("wasm load failed", ErrorType.ZK_ERROR)).toBe(true);
      expect(isErrorType("wasm load failed", ErrorType.CONTRACT_REVERT)).toBe(false);
    });

    it("should correctly identify RPC_ERROR type", () => {
      expect(isErrorType("network error", ErrorType.RPC_ERROR)).toBe(true);
      expect(isErrorType("network error", ErrorType.ZK_ERROR)).toBe(false);
    });

    it("should correctly identify VALIDATION_ERROR type", () => {
      expect(isErrorType("invalid note format", ErrorType.VALIDATION_ERROR)).toBe(true);
      expect(isErrorType("invalid note format", ErrorType.RPC_ERROR)).toBe(false);
    });
  });

  describe("isErrorCode", () => {
    it("should correctly identify specific error codes", () => {
      expect(isErrorCode("Invalid proof", ContractErrorCode.INVALID_PROOF)).toBe(true);
      expect(isErrorCode("Invalid proof", ContractErrorCode.NULLIFIER_ALREADY_USED)).toBe(false);
    });

    it("should correctly identify ZK error codes", () => {
      expect(isErrorCode("wasm load failed", ZkErrorCode.WASM_LOAD_FAILED)).toBe(true);
      expect(isErrorCode("zkey load failed", ZkErrorCode.ZKEY_LOAD_FAILED)).toBe(true);
    });

    it("should correctly identify RPC error codes", () => {
      expect(isErrorCode("user rejected", RpcErrorCode.USER_REJECTED)).toBe(true);
      expect(isErrorCode("insufficient funds", RpcErrorCode.INSUFFICIENT_FUNDS)).toBe(true);
    });
  });

  describe("Locale Management", () => {
    it("should set and get locale", () => {
      setErrorLocale("zh");
      expect(getErrorLocale()).toBe("zh");

      setErrorLocale("en");
      expect(getErrorLocale()).toBe("en");
    });

    it("should use current locale with getLocalizedError", () => {
      setErrorLocale("zh");
      const message = getLocalizedError("InvalidProof");
      expect(message).toBe("证明无效。请重新生成证明后再试。");

      setErrorLocale("en");
      const messageEn = getLocalizedError("InvalidProof");
      expect(messageEn).toBe("Invalid proof. Please regenerate the proof and try again.");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      const message = getErrorMessage("");
      expect(message).toBe("An unexpected error occurred. Please try again.");
    });

    it("should handle number input", () => {
      const message = getErrorMessage(42);
      expect(message).toBe("An unexpected error occurred. Please try again.");
    });

    it("should handle boolean input", () => {
      const message = getErrorMessage(false);
      expect(message).toBe("An unexpected error occurred. Please try again.");
    });

    it("should handle array input", () => {
      const message = getErrorMessage(["error1", "error2"]);
      expect(message).toBe("An unexpected error occurred. Please try again.");
    });

    it("should handle deeply nested object", () => {
      const error = {
        outer: {
          inner: {
            message: "Invalid proof",
          },
        },
      };
      // The JSON stringification will contain "Invalid proof", which will match the pattern
      // This is actually useful behavior - we extract error info even from nested structures
      const message = getErrorMessage(error);
      expect(message).toBe("Invalid proof. Please regenerate the proof and try again.");
    });

    it("should handle Error with only stack", () => {
      const error = new Error();
      error.message = "";
      const message = getErrorMessage(error);
      expect(message).toBe("An unexpected error occurred. Please try again.");
    });

    it("should handle case-insensitive matching", () => {
      expect(getErrorMessage("INVALID PROOF")).toBe("Invalid proof. Please regenerate the proof and try again.");
      expect(getErrorMessage("invalid proof")).toBe("Invalid proof. Please regenerate the proof and try again.");
      expect(getErrorMessage("Invalid Proof")).toBe("Invalid proof. Please regenerate the proof and try again.");
    });
  });

  describe("Real-world Error Scenarios", () => {
    it("should handle viem ContractFunctionExecutionError", () => {
      const error = {
        name: "ContractFunctionExecutionError",
        message: "Contract function execution reverted",
        shortMessage: "Invalid proof",
        data: {
          message: "execution reverted",
        },
      };
      const message = getErrorMessage(error);
      expect(message).toBe("Invalid proof. Please regenerate the proof and try again.");
    });

    it("should handle ethers CallException", () => {
      const error = {
        code: "CALL_EXCEPTION",
        message: "call revert exception",
        reason: "Nullifier has been used",
        method: "withdraw",
      };
      const message = getErrorMessage(error);
      expect(message).toBe("This note has already been used for withdrawal.");
    });

    it("should handle MetaMask user rejection", () => {
      const error = {
        code: 4001,
        message: "MetaMask Tx Signature: User denied transaction signature.",
      };
      const message = getErrorMessage(error);
      expect(message).toBe("Transaction was rejected by user.");
    });

    it("should handle snarkjs proof generation error", () => {
      const error = new Error("Error: groth16 prove operation failed - invalid input");
      const message = getErrorMessage(error);
      expect(message).toBe("Proof generation failed. Please verify your note and try again.");
    });

    it("should handle fetch error for wasm", () => {
      const error = new Error("Failed to fetch wasm module from /zk/withdraw.wasm");
      const message = getErrorMessage(error);
      expect(message).toBe("Failed to load ZK circuit. Please refresh the page and try again.");
    });
  });
});
