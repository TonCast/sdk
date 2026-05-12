import { Address } from "@ton/core";
import { ToncastError } from "../errors";

declare const tonAddressBrand: unique symbol;

export type TonAddressString = string & { readonly [tonAddressBrand]: true };

/**
 * Validate a TON friendly/raw address while preserving the caller-provided
 * representation. The SDK uses this at security-sensitive boundaries before
 * preparing signable transactions.
 */
export function parseTonAddress(value: string, field = "address"): TonAddressString {
  try {
    Address.parse(value);
    return value as TonAddressString;
  } catch (err) {
    throw new ToncastError(`Invalid ${field}: expected a TON address`, "INVALID_ADDRESS", err);
  }
}
