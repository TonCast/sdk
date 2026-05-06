/**
 * Decimal-string ↔ raw-units helpers for jetton/TON amounts.
 *
 * Mirror the viem/ethers `parseUnits` / `formatUnits` API so integrators
 * coming from EVM tooling find familiar names. The SDK speaks BigInts
 * everywhere on input/output, so the demo / Node servers / scripts can
 * use these to bridge to / from human-typed strings ("1.66" USDT,
 * "115" TCAST, "0.5" TON).
 */

import { ToncastError } from "../errors";

/**
 * Parse a decimal string ("1.66", "115", "0.5") into raw token units
 * using the given `decimals`. Trailing fractional digits beyond
 * `decimals` are silently truncated (not rounded).
 *
 * - Empty string → `0n`.
 * - Comma is normalised to dot ("1,66" → "1.66").
 * - Throws {@link ToncastError} (`"INVALID_DECIMAL_STRING"`) on garbage
 *   input ("abc", "1.2.3", "."), so callers can `.catch` and fall back
 *   to a stale value or empty-state.
 *
 * Inverse of {@link formatUnits}.
 *
 * @example
 * parseUnits("1.66", 6) === 1_660_000n         // USDT (6 decimals)
 * parseUnits("0.5", 9)  === 500_000_000n       // TON (9 decimals)
 * parseUnits("", 9)     === 0n
 */
export function parseUnits(value: string, decimals: number): bigint {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new ToncastError(
      `decimals must be a non-negative integer, got ${decimals}`,
      "INVALID_DECIMALS",
    );
  }
  const s = value.trim().replace(/,/g, ".");
  if (!s) return 0n;
  if (!/^\d*\.?\d*$/.test(s) || s === ".") {
    throw new ToncastError(`Not a valid decimal string: "${value}"`, "INVALID_DECIMAL_STRING");
  }
  const [whole = "0", frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/**
 * Format raw token units back into a human-readable decimal string,
 * trimming trailing zeros and clipping to `maxFracDigits` fractional
 * digits (default = full precision).
 *
 * Inverse of {@link parseUnits}.
 *
 * @example
 * formatUnits(1_660_000n, 6) === "1.66"
 * formatUnits(500_000_000n, 9) === "0.5"
 * formatUnits(32_051_709_428n, 9, 4) === "32.0517"   // clipped
 */
export function formatUnits(amount: bigint, decimals: number, maxFracDigits?: number): string {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new ToncastError(
      `decimals must be a non-negative integer, got ${decimals}`,
      "INVALID_DECIMALS",
    );
  }
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const frac = abs % divisor;
  let frString = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  if (typeof maxFracDigits === "number" && frString.length > maxFracDigits) {
    frString = frString.slice(0, maxFracDigits).replace(/0+$/, "");
  }
  const body = frString ? `${whole}.${frString}` : whole.toString();
  return negative ? `-${body}` : body;
}
