import { fromNano } from "@ton/core";
import type { AvailableCoin } from "@toncast/sdk";

/** Format nano-TON as TON without trailing zeros (UI). */
export function ton(nano: bigint): string {
  return fromNano(nano);
}

/** Format raw jetton amount using its `decimals`. */
export function coinAmount(coin: AvailableCoin): string {
  const decimals = coin.decimals ?? 9;
  return formatRawAmount(coin.amount, decimals);
}

function formatRawAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;
  if (fractional === 0n) return whole.toString();
  const frac = fractional.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${frac}`;
}

/**
 * Public alias that also clips trailing fraction digits — convenient for
 * UI labels that don't have room for 9 decimals of TCAST.
 */
export function formatRaw(amount: bigint, decimals: number, maxFracDigits = 6): string {
  return trimFraction(formatRawAmount(amount, decimals), maxFracDigits);
}

function trimFraction(value: string, maxFracDigits: number): string {
  const dot = value.indexOf(".");
  if (dot === -1) return value;
  return value
    .slice(0, dot + 1 + maxFracDigits)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

/** Truncate long TON address for display: `EQAB…CDEF`. */
export function shortAddr(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/**
 * Compact "time until close" — "2d 5h", "3h 45m", "12m", "ended".
 * `endTime` is a Unix timestamp in seconds (matches the SDK shape).
 */
export function formatTimeLeft(endTime: number, now: number = Date.now()): string {
  const remaining = Math.floor(endTime - now / 1000);
  if (remaining <= 0) return "ended";
  const d = Math.floor(remaining / 86_400);
  const h = Math.floor((remaining % 86_400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
