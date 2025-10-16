import { isAddress } from "viem";

export function isValidRecipientAddress(addr?: string | null): boolean {
  if (!addr) return false;
  return isAddress(addr as `0x${string}`);
}

