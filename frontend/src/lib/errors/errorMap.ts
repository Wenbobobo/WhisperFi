/**
 * Error mapping module for WhisperFi
 * Maps contract reverts, ZK errors, and RPC errors to user-friendly messages
 */

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorType {
  CONTRACT_REVERT = "CONTRACT_REVERT",
  ZK_ERROR = "ZK_ERROR",
  RPC_ERROR = "RPC_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNKNOWN = "UNKNOWN",
}

// ============================================================================
// Supported Locales
// ============================================================================

export type Locale = "en" | "zh";

const DEFAULT_LOCALE: Locale = "en";

// ============================================================================
// Error Code Definitions
// ============================================================================

// Contract revert error codes (from PrivacyPool.sol)
export enum ContractErrorCode {
  INVALID_DEPOSIT_AMOUNT = "InvalidDepositAmount",
  INVALID_MERKLE_ROOT = "InvalidMerkleRoot",
  NULLIFIER_ALREADY_USED = "NullifierAlreadyUsed",
  FEE_EXCEEDS_DEPOSIT = "FeeExceedsDeposit",
  INVALID_PROOF = "InvalidProof",
  INVALID_ZK_PROOF = "InvalidZKProof",
  MERKLE_TREE_FULL = "MerkleTreeFull",
  RECIPIENT_TRANSFER_FAILED = "RecipientTransferFailed",
  RELAYER_TRANSFER_FAILED = "RelayerTransferFailed",
  TRADE_EXECUTION_FAILED = "TradeExecutionFailed",
  INVALID_TRADE_DATA_HASH = "InvalidTradeDataHash",
  REENTRANCY_GUARD = "ReentrancyGuard",
  INSUFFICIENT_FEE = "InsufficientFee",
  INVALID_ROOT = "InvalidRoot",
}

// ZK error codes
export enum ZkErrorCode {
  WASM_LOAD_FAILED = "WasmLoadFailed",
  ZKEY_LOAD_FAILED = "ZkeyLoadFailed",
  PROOF_GENERATION_FAILED = "ProofGenerationFailed",
  PROOF_VERIFICATION_FAILED = "ProofVerificationFailed",
  INVALID_WITNESS = "InvalidWitness",
  CIRCUIT_ERROR = "CircuitError",
  SNARK_SCALAR_FIELD_OVERFLOW = "SnarkScalarFieldOverflow",
  MERKLE_TREE_ERROR = "MerkleTreeError",
  COMMITMENT_NOT_FOUND = "CommitmentNotFound",
  NO_DEPOSITS_FOUND = "NoDepositsFound",
}

// RPC/Network error codes
export enum RpcErrorCode {
  NETWORK_ERROR = "NetworkError",
  TIMEOUT_ERROR = "TimeoutError",
  INSUFFICIENT_FUNDS = "InsufficientFunds",
  USER_REJECTED = "UserRejected",
  CHAIN_MISMATCH = "ChainMismatch",
  WALLET_NOT_CONNECTED = "WalletNotConnected",
  TRANSACTION_FAILED = "TransactionFailed",
  GAS_ESTIMATION_FAILED = "GasEstimationFailed",
  NONCE_TOO_LOW = "NonceTooLow",
  REPLACEMENT_UNDERPRICED = "ReplacementUnderpriced",
  RPC_UNAVAILABLE = "RpcUnavailable",
}

// Validation error codes
export enum ValidationErrorCode {
  INVALID_NOTE_FORMAT = "InvalidNoteFormat",
  INVALID_RECIPIENT_ADDRESS = "InvalidRecipientAddress",
  INVALID_RELAYER_ADDRESS = "InvalidRelayerAddress",
  INVALID_FEE_AMOUNT = "InvalidFeeAmount",
  EMPTY_NOTE = "EmptyNote",
  INVALID_AMOUNT = "InvalidAmount",
}

// ============================================================================
// Error Messages (i18n-ready structure)
// ============================================================================

type ErrorMessages = {
  [key: string]: {
    en: string;
    zh: string;
  };
};

// Contract revert messages
const CONTRACT_ERROR_MESSAGES: ErrorMessages = {
  [ContractErrorCode.INVALID_DEPOSIT_AMOUNT]: {
    en: "Invalid deposit amount. Please deposit exactly 0.1 ETH.",
    zh: "存款金额无效。请存入正好 0.1 ETH。",
  },
  [ContractErrorCode.INVALID_MERKLE_ROOT]: {
    en: "Invalid Merkle root. The proof may be outdated. Please regenerate.",
    zh: "Merkle 根无效。证明可能已过期，请重新生成。",
  },
  [ContractErrorCode.NULLIFIER_ALREADY_USED]: {
    en: "This note has already been used for withdrawal.",
    zh: "此凭证已被使用进行提款。",
  },
  [ContractErrorCode.FEE_EXCEEDS_DEPOSIT]: {
    en: "The relayer fee exceeds the deposit amount.",
    zh: "中继费用超过了存款金额。",
  },
  [ContractErrorCode.INVALID_PROOF]: {
    en: "Invalid proof. Please regenerate the proof and try again.",
    zh: "证明无效。请重新生成证明后再试。",
  },
  [ContractErrorCode.INVALID_ZK_PROOF]: {
    en: "ZK proof verification failed. Please regenerate the proof.",
    zh: "零知识证明验证失败。请重新生成证明。",
  },
  [ContractErrorCode.MERKLE_TREE_FULL]: {
    en: "The privacy pool is full. Please try again later.",
    zh: "隐私池已满。请稍后再试。",
  },
  [ContractErrorCode.RECIPIENT_TRANSFER_FAILED]: {
    en: "Failed to transfer funds to recipient. Please check the address.",
    zh: "向接收者转账失败。请检查地址。",
  },
  [ContractErrorCode.RELAYER_TRANSFER_FAILED]: {
    en: "Failed to transfer fee to relayer. Please check the relayer address.",
    zh: "向中继者转账失败。请检查中继者地址。",
  },
  [ContractErrorCode.TRADE_EXECUTION_FAILED]: {
    en: "Trade execution failed. Please verify trade parameters.",
    zh: "交易执行失败。请验证交易参数。",
  },
  [ContractErrorCode.INVALID_TRADE_DATA_HASH]: {
    en: "Invalid trade data hash. The trade parameters may have been tampered.",
    zh: "交易数据哈希无效。交易参数可能已被篡改。",
  },
  [ContractErrorCode.REENTRANCY_GUARD]: {
    en: "Transaction rejected due to reentrancy protection.",
    zh: "由于重入保护，交易被拒绝。",
  },
  [ContractErrorCode.INSUFFICIENT_FEE]: {
    en: "Insufficient fee provided for the transaction.",
    zh: "提供的手续费不足。",
  },
  [ContractErrorCode.INVALID_ROOT]: {
    en: "Invalid Merkle root. Please refresh and try again.",
    zh: "Merkle 根无效。请刷新后重试。",
  },
};

// ZK error messages
const ZK_ERROR_MESSAGES: ErrorMessages = {
  [ZkErrorCode.WASM_LOAD_FAILED]: {
    en: "Failed to load ZK circuit. Please refresh the page and try again.",
    zh: "加载零知识电路失败。请刷新页面后重试。",
  },
  [ZkErrorCode.ZKEY_LOAD_FAILED]: {
    en: "Failed to load proving key. Please check your connection and try again.",
    zh: "加载证明密钥失败。请检查网络连接后重试。",
  },
  [ZkErrorCode.PROOF_GENERATION_FAILED]: {
    en: "Proof generation failed. Please verify your note and try again.",
    zh: "生成证明失败。请验证您的凭证后重试。",
  },
  [ZkErrorCode.PROOF_VERIFICATION_FAILED]: {
    en: "Proof verification failed. The proof may be invalid or corrupted.",
    zh: "证明验证失败。证明可能无效或已损坏。",
  },
  [ZkErrorCode.INVALID_WITNESS]: {
    en: "Invalid witness data. Please ensure your note is correct.",
    zh: "见证数据无效。请确保您的凭证正确。",
  },
  [ZkErrorCode.CIRCUIT_ERROR]: {
    en: "Circuit computation error. Please try again.",
    zh: "电路计算错误。请重试。",
  },
  [ZkErrorCode.SNARK_SCALAR_FIELD_OVERFLOW]: {
    en: "Value exceeds SNARK scalar field. Please contact support.",
    zh: "数值超出 SNARK 标量域。请联系支持。",
  },
  [ZkErrorCode.MERKLE_TREE_ERROR]: {
    en: "Merkle tree computation error. Please reset cache and try again.",
    zh: "Merkle 树计算错误。请重置缓存后重试。",
  },
  [ZkErrorCode.COMMITMENT_NOT_FOUND]: {
    en: "Your deposit commitment was not found in the Merkle tree. Try resetting the cache.",
    zh: "在 Merkle 树中未找到您的存款承诺。请尝试重置缓存。",
  },
  [ZkErrorCode.NO_DEPOSITS_FOUND]: {
    en: "No deposit events found. The pool is empty.",
    zh: "未找到存款事件。池为空。",
  },
};

// RPC error messages
const RPC_ERROR_MESSAGES: ErrorMessages = {
  [RpcErrorCode.NETWORK_ERROR]: {
    en: "Network error. Please check your internet connection.",
    zh: "网络错误。请检查您的互联网连接。",
  },
  [RpcErrorCode.TIMEOUT_ERROR]: {
    en: "Request timed out. Please try again.",
    zh: "请求超时。请重试。",
  },
  [RpcErrorCode.INSUFFICIENT_FUNDS]: {
    en: "Insufficient funds in wallet. Please add more ETH.",
    zh: "钱包余额不足。请添加更多 ETH。",
  },
  [RpcErrorCode.USER_REJECTED]: {
    en: "Transaction was rejected by user.",
    zh: "交易被用户拒绝。",
  },
  [RpcErrorCode.CHAIN_MISMATCH]: {
    en: "Wrong network. Please switch to the correct network.",
    zh: "网络错误。请切换到正确的网络。",
  },
  [RpcErrorCode.WALLET_NOT_CONNECTED]: {
    en: "Wallet not connected. Please connect your wallet first.",
    zh: "钱包未连接。请先连接您的钱包。",
  },
  [RpcErrorCode.TRANSACTION_FAILED]: {
    en: "Transaction failed. Please try again.",
    zh: "交易失败。请重试。",
  },
  [RpcErrorCode.GAS_ESTIMATION_FAILED]: {
    en: "Gas estimation failed. The transaction may fail.",
    zh: "Gas 估算失败。交易可能会失败。",
  },
  [RpcErrorCode.NONCE_TOO_LOW]: {
    en: "Transaction nonce too low. Please try again.",
    zh: "交易 nonce 过低。请重试。",
  },
  [RpcErrorCode.REPLACEMENT_UNDERPRICED]: {
    en: "Replacement transaction underpriced. Please increase gas price.",
    zh: "替换交易价格过低。请提高 gas 价格。",
  },
  [RpcErrorCode.RPC_UNAVAILABLE]: {
    en: "RPC endpoint unavailable. Please try again later.",
    zh: "RPC 端点不可用。请稍后重试。",
  },
};

// Validation error messages
const VALIDATION_ERROR_MESSAGES: ErrorMessages = {
  [ValidationErrorCode.INVALID_NOTE_FORMAT]: {
    en: "Invalid note format. Please check your note.",
    zh: "凭证格式无效。请检查您的凭证。",
  },
  [ValidationErrorCode.INVALID_RECIPIENT_ADDRESS]: {
    en: "Invalid recipient address. Please enter a valid Ethereum address.",
    zh: "接收地址无效。请输入有效的以太坊地址。",
  },
  [ValidationErrorCode.INVALID_RELAYER_ADDRESS]: {
    en: "Invalid relayer address. Please enter a valid Ethereum address.",
    zh: "中继地址无效。请输入有效的以太坊地址。",
  },
  [ValidationErrorCode.INVALID_FEE_AMOUNT]: {
    en: "Invalid fee amount. Please enter a valid number.",
    zh: "费用金额无效。请输入有效的数字。",
  },
  [ValidationErrorCode.EMPTY_NOTE]: {
    en: "Please enter your note.",
    zh: "请输入您的凭证。",
  },
  [ValidationErrorCode.INVALID_AMOUNT]: {
    en: "Invalid amount. Please enter a valid number.",
    zh: "金额无效。请输入有效的数字。",
  },
};

// Generic error messages
const GENERIC_ERROR_MESSAGES: ErrorMessages = {
  unknown: {
    en: "An unexpected error occurred. Please try again.",
    zh: "发生意外错误。请重试。",
  },
  generic_contract: {
    en: "Contract execution failed. Please try again.",
    zh: "合约执行失败。请重试。",
  },
  generic_zk: {
    en: "Zero-knowledge proof error. Please try again.",
    zh: "零知识证明错误。请重试。",
  },
  generic_rpc: {
    en: "Network communication error. Please try again.",
    zh: "网络通信错误。请重试。",
  },
};

// ============================================================================
// Error Pattern Matchers
// ============================================================================

interface ErrorPattern {
  pattern: RegExp;
  code: string;
  type: ErrorType;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Contract revert patterns (from PrivacyPool.sol require statements)
  { pattern: /Invalid deposit amount/i, code: ContractErrorCode.INVALID_DEPOSIT_AMOUNT, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Invalid Merkle root/i, code: ContractErrorCode.INVALID_MERKLE_ROOT, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Nullifier has been used/i, code: ContractErrorCode.NULLIFIER_ALREADY_USED, type: ErrorType.CONTRACT_REVERT },
  { pattern: /NullifierAlreadyUsed/i, code: ContractErrorCode.NULLIFIER_ALREADY_USED, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Fee exceeds deposit/i, code: ContractErrorCode.FEE_EXCEEDS_DEPOSIT, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Invalid proof/i, code: ContractErrorCode.INVALID_PROOF, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Invalid ZK proof/i, code: ContractErrorCode.INVALID_ZK_PROOF, type: ErrorType.CONTRACT_REVERT },
  { pattern: /InvalidProof/i, code: ContractErrorCode.INVALID_PROOF, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Merkle tree is full/i, code: ContractErrorCode.MERKLE_TREE_FULL, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Recipient transfer failed/i, code: ContractErrorCode.RECIPIENT_TRANSFER_FAILED, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Relayer transfer failed/i, code: ContractErrorCode.RELAYER_TRANSFER_FAILED, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Trade execution failed/i, code: ContractErrorCode.TRADE_EXECUTION_FAILED, type: ErrorType.CONTRACT_REVERT },
  { pattern: /Invalid trade data hash/i, code: ContractErrorCode.INVALID_TRADE_DATA_HASH, type: ErrorType.CONTRACT_REVERT },
  { pattern: /ReentrancyGuard: reentrant call/i, code: ContractErrorCode.REENTRANCY_GUARD, type: ErrorType.CONTRACT_REVERT },
  { pattern: /InsufficientFee/i, code: ContractErrorCode.INSUFFICIENT_FEE, type: ErrorType.CONTRACT_REVERT },
  { pattern: /InvalidRoot/i, code: ContractErrorCode.INVALID_ROOT, type: ErrorType.CONTRACT_REVERT },

  // ZK error patterns
  { pattern: /wasm.*load|load.*wasm|fetch.*wasm/i, code: ZkErrorCode.WASM_LOAD_FAILED, type: ErrorType.ZK_ERROR },
  { pattern: /zkey.*load|load.*zkey|fetch.*zkey/i, code: ZkErrorCode.ZKEY_LOAD_FAILED, type: ErrorType.ZK_ERROR },
  { pattern: /proof.*generation.*fail|fail.*generat.*proof|groth16.*prove/i, code: ZkErrorCode.PROOF_GENERATION_FAILED, type: ErrorType.ZK_ERROR },
  { pattern: /proof.*verification.*fail|fail.*verif.*proof/i, code: ZkErrorCode.PROOF_VERIFICATION_FAILED, type: ErrorType.ZK_ERROR },
  { pattern: /invalid.*witness|witness.*invalid/i, code: ZkErrorCode.INVALID_WITNESS, type: ErrorType.ZK_ERROR },
  { pattern: /circuit.*error|circom/i, code: ZkErrorCode.CIRCUIT_ERROR, type: ErrorType.ZK_ERROR },
  { pattern: /scalar.*field|SNARK_SCALAR_FIELD/i, code: ZkErrorCode.SNARK_SCALAR_FIELD_OVERFLOW, type: ErrorType.ZK_ERROR },
  { pattern: /commitment was not found/i, code: ZkErrorCode.COMMITMENT_NOT_FOUND, type: ErrorType.ZK_ERROR },
  { pattern: /No deposit events found/i, code: ZkErrorCode.NO_DEPOSITS_FOUND, type: ErrorType.ZK_ERROR },

  // RPC/Network error patterns
  { pattern: /network.*error|ERR_NETWORK|ENOTFOUND|ECONNREFUSED/i, code: RpcErrorCode.NETWORK_ERROR, type: ErrorType.RPC_ERROR },
  { pattern: /timeout|ETIMEDOUT|request.*timed.*out/i, code: RpcErrorCode.TIMEOUT_ERROR, type: ErrorType.RPC_ERROR },
  { pattern: /insufficient.*funds|insufficient balance/i, code: RpcErrorCode.INSUFFICIENT_FUNDS, type: ErrorType.RPC_ERROR },
  { pattern: /user rejected|user denied|ACTION_REJECTED/i, code: RpcErrorCode.USER_REJECTED, type: ErrorType.RPC_ERROR },
  { pattern: /wrong.*chain|chain.*mismatch|network.*mismatch/i, code: RpcErrorCode.CHAIN_MISMATCH, type: ErrorType.RPC_ERROR },
  { pattern: /wallet.*not.*connected|no.*wallet/i, code: RpcErrorCode.WALLET_NOT_CONNECTED, type: ErrorType.RPC_ERROR },
  { pattern: /transaction.*fail|execution.*reverted/i, code: RpcErrorCode.TRANSACTION_FAILED, type: ErrorType.RPC_ERROR },
  { pattern: /gas.*estimation.*fail|cannot.*estimate.*gas/i, code: RpcErrorCode.GAS_ESTIMATION_FAILED, type: ErrorType.RPC_ERROR },
  { pattern: /nonce.*too.*low|nonce.*already.*used/i, code: RpcErrorCode.NONCE_TOO_LOW, type: ErrorType.RPC_ERROR },
  { pattern: /replacement.*underpriced|transaction.*underpriced/i, code: RpcErrorCode.REPLACEMENT_UNDERPRICED, type: ErrorType.RPC_ERROR },
  { pattern: /rpc.*unavailable|provider.*unavailable|endpoint.*unavailable/i, code: RpcErrorCode.RPC_UNAVAILABLE, type: ErrorType.RPC_ERROR },

  // Validation error patterns
  { pattern: /invalid.*note.*format|note.*format.*invalid/i, code: ValidationErrorCode.INVALID_NOTE_FORMAT, type: ErrorType.VALIDATION_ERROR },
  { pattern: /invalid.*recipient|recipient.*invalid/i, code: ValidationErrorCode.INVALID_RECIPIENT_ADDRESS, type: ErrorType.VALIDATION_ERROR },
  { pattern: /invalid.*relayer|relayer.*invalid/i, code: ValidationErrorCode.INVALID_RELAYER_ADDRESS, type: ErrorType.VALIDATION_ERROR },
  { pattern: /invalid.*fee|fee.*invalid/i, code: ValidationErrorCode.INVALID_FEE_AMOUNT, type: ErrorType.VALIDATION_ERROR },
  { pattern: /empty.*note|note.*empty|enter.*note/i, code: ValidationErrorCode.EMPTY_NOTE, type: ErrorType.VALIDATION_ERROR },
  { pattern: /invalid.*amount|amount.*invalid/i, code: ValidationErrorCode.INVALID_AMOUNT, type: ErrorType.VALIDATION_ERROR },
];

// ============================================================================
// Error Parsing and Message Retrieval
// ============================================================================

/**
 * Structured error information
 */
export interface ParsedError {
  type: ErrorType;
  code: string;
  originalMessage: string;
}

/**
 * Extract error message from various error formats
 */
function extractErrorMessage(error: unknown): string {
  if (error === null || error === undefined) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    // Handle viem/ethers error data (check reason and shortMessage first)
    const errorWithData = error as Error & {
      data?: { message?: string };
      reason?: string;
      shortMessage?: string;
      cause?: unknown;
    };

    // Priority order: reason > shortMessage > cause > data.message > message
    if (errorWithData.reason) {
      return errorWithData.reason;
    }
    if (errorWithData.shortMessage) {
      return errorWithData.shortMessage;
    }

    // Handle nested errors (e.g., cause property)
    if (errorWithData.cause) {
      const causeMessage = extractErrorMessage(errorWithData.cause);
      if (causeMessage) {
        return `${error.message}: ${causeMessage}`;
      }
    }

    if (errorWithData.data?.message) {
      return errorWithData.data.message;
    }

    return error.message;
  }

  // Handle object with message property
  if (typeof error === "object") {
    const errorObj = error as Record<string, unknown>;

    // Check common error message properties
    // Priority: reason > shortMessage > data.message > message
    // (data.message often contains the specific revert reason, while message is generic)
    if (typeof errorObj.reason === "string") {
      return errorObj.reason;
    }
    if (typeof errorObj.shortMessage === "string") {
      return errorObj.shortMessage;
    }
    if (errorObj.data && typeof (errorObj.data as Record<string, unknown>).message === "string") {
      return (errorObj.data as Record<string, unknown>).message as string;
    }
    if (typeof errorObj.message === "string") {
      return errorObj.message;
    }

    // Try to stringify
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

/**
 * Parse an error and identify its type and code
 */
export function parseError(error: unknown): ParsedError {
  const message = extractErrorMessage(error);

  // Try to match against known patterns
  for (const { pattern, code, type } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return { type, code, originalMessage: message };
    }
  }

  // Determine generic type based on error characteristics
  if (message.includes("revert") || message.includes("require")) {
    return { type: ErrorType.CONTRACT_REVERT, code: "generic_contract", originalMessage: message };
  }

  if (message.includes("snark") || message.includes("circom") || message.includes("proof")) {
    return { type: ErrorType.ZK_ERROR, code: "generic_zk", originalMessage: message };
  }

  if (message.includes("rpc") || message.includes("network") || message.includes("provider")) {
    return { type: ErrorType.RPC_ERROR, code: "generic_rpc", originalMessage: message };
  }

  return { type: ErrorType.UNKNOWN, code: "unknown", originalMessage: message };
}

/**
 * Get the localized message for an error code
 */
function getLocalizedMessage(code: string, locale: Locale): string | undefined {
  const messageMaps = [
    CONTRACT_ERROR_MESSAGES,
    ZK_ERROR_MESSAGES,
    RPC_ERROR_MESSAGES,
    VALIDATION_ERROR_MESSAGES,
    GENERIC_ERROR_MESSAGES,
  ];

  for (const messages of messageMaps) {
    if (messages[code]) {
      return messages[code][locale];
    }
  }

  return undefined;
}

/**
 * Get a user-friendly error message for any error
 * @param error - The error to process (can be any type)
 * @param locale - The locale for the message (defaults to 'en')
 * @returns A user-friendly error message string
 */
export function getErrorMessage(error: unknown, locale: Locale = DEFAULT_LOCALE): string {
  const parsed = parseError(error);
  const localizedMessage = getLocalizedMessage(parsed.code, locale);

  if (localizedMessage) {
    return localizedMessage;
  }

  // Return generic message based on type
  switch (parsed.type) {
    case ErrorType.CONTRACT_REVERT:
      return GENERIC_ERROR_MESSAGES.generic_contract[locale];
    case ErrorType.ZK_ERROR:
      return GENERIC_ERROR_MESSAGES.generic_zk[locale];
    case ErrorType.RPC_ERROR:
      return GENERIC_ERROR_MESSAGES.generic_rpc[locale];
    default:
      return GENERIC_ERROR_MESSAGES.unknown[locale];
  }
}

/**
 * Get error message with error code for debugging
 */
export function getErrorMessageWithCode(error: unknown, locale: Locale = DEFAULT_LOCALE): {
  message: string;
  code: string;
  type: ErrorType;
} {
  const parsed = parseError(error);
  const message = getErrorMessage(error, locale);

  return {
    message,
    code: parsed.code,
    type: parsed.type,
  };
}

/**
 * Check if an error is of a specific type
 */
export function isErrorType(error: unknown, type: ErrorType): boolean {
  const parsed = parseError(error);
  return parsed.type === type;
}

/**
 * Check if an error matches a specific code
 */
export function isErrorCode(
  error: unknown,
  code: ContractErrorCode | ZkErrorCode | RpcErrorCode | ValidationErrorCode
): boolean {
  const parsed = parseError(error);
  return parsed.code === code;
}

// ============================================================================
// Locale Management
// ============================================================================

let currentLocale: Locale = DEFAULT_LOCALE;

/**
 * Set the default locale for error messages
 */
export function setErrorLocale(locale: Locale): void {
  currentLocale = locale;
}

/**
 * Get the current default locale
 */
export function getErrorLocale(): Locale {
  return currentLocale;
}

/**
 * Get error message using the current default locale
 */
export function getLocalizedError(error: unknown): string {
  return getErrorMessage(error, currentLocale);
}
