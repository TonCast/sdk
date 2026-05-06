import { fromNano } from "@ton/core";

export function ton(nano: bigint): string {
  return fromNano(nano);
}

export function formatRaw(amount: bigint, decimals: number, maxFracDigits = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;
  let value: string;
  if (fractional === 0n) {
    value = whole.toString();
  } else {
    const frac = fractional.toString().padStart(decimals, "0").replace(/0+$/, "");
    value = `${whole}.${frac}`;
  }
  const dot = value.indexOf(".");
  if (dot === -1) return value;
  return value
    .slice(0, dot + 1 + maxFracDigits)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

export function shortAddr(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

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
