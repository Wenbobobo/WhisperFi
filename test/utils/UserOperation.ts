/**
 * @notice Represents the structure of a "packed" UserOperation.
 * @dev This is a client-side representation that aligns with the PackedUserOperation
 * struct defined in the EntryPoint contract. It is used to construct and sign
 * user operations before sending them to the bundler.
 *
 * @field sender - The address of the smart account.
 * @field nonce - The nonce for this specific operation from the sender.
 * @field initCode - The initialization code for the smart account (if it does not exist yet).
 * @field callData - The data for the function call to be executed by the smart account.
 * @field accountGasLimits - Packed gas limits for verification and execution. Use `packUints` to encode.
 * @field preVerificationGas - The amount of gas to compensate the bundler for its pre-verification work.
 * @field gasFees - Packed maxFeePerGas and maxPriorityFeePerGas. Use `packUints` to encode.
 * @field paymasterAndData - The address of the paymaster followed by its associated data.
 * @field signature - The signature over the UserOperation hash.
 */
export interface PackedUserOperation {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  accountGasLimits: string;
  preVerificationGas: bigint;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
}
