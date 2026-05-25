import { Address } from "@ton/core";
import { ToncastError } from "../errors";

declare const tonAddressBrand: unique symbol;

export type TonAddressString = string & { readonly [tonAddressBrand]: true };

/**
 * Validate a TON friendly/raw address and return the canonical bounceable
 * EQ-form (`Address.parse(value).toString()`). Same wallet reconnecting as
 * `UQ…` vs `EQ…` must compare equal everywhere in SDK state and caches.
 */
export function parseTonAddress(value: string, field = "address"): TonAddressString {
  try {
    return Address.parse(value).toString() as TonAddressString;
  } catch (err) {
    throw new ToncastError(`Invalid ${field}: expected a TON address`, "INVALID_ADDRESS", err);
  }
}

/** Alias for {@link parseTonAddress} when a plain `string` return type reads clearer. */
export function normalizeTonAddress(value: string, field = "address"): string {
  return parseTonAddress(value, field);
}

/** `true` when both values denote the same on-chain wallet (any friendly/raw format). */
export function sameTonAddress(a: string, b: string): boolean {
  try {
    return Address.parse(a).toString() === Address.parse(b).toString();
  } catch {
    return false;
  }
}
