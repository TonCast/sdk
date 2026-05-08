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

export type TimeLeftTranslate = (
  key:
    | "time.ended"
    | "time.daysHours"
    | "time.hoursMinutes"
    | "time.minutes"
    | "time.lessThanMinute",
  vars?: Record<string, number>,
) => string;

/** English prose fallback used when no translator is provided. */
function englishTimeLeft(
  key: Parameters<TimeLeftTranslate>[0],
  vars?: Record<string, number>,
): string {
  switch (key) {
    case "time.ended": return "ended";
    case "time.daysHours": return `${vars?.d ?? 0}d ${vars?.h ?? 0}h`;
    case "time.hoursMinutes": return `${vars?.h ?? 0}h ${vars?.m ?? 0}m`;
    case "time.minutes": return `${vars?.m ?? 0}m`;
    case "time.lessThanMinute": return "< 1m";
  }
}

/**
 * Returns a human-readable time remaining string.
 * Pass a `t` translator to get localised output; omit for English fallback.
 */
export function formatTimeLeft(
  endTime: number,
  t?: TimeLeftTranslate,
  now: number = Date.now(),
): string {
  const translate = t ?? englishTimeLeft;
  const remaining = Math.floor(endTime - now / 1000);
  if (remaining <= 0) return translate("time.ended");
  const d = Math.floor(remaining / 86_400);
  const h = Math.floor((remaining % 86_400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  if (d > 0) return translate("time.daysHours", { d, h });
  if (h > 0) return translate("time.hoursMinutes", { h, m });
  if (m > 0) return translate("time.minutes", { m });
  return translate("time.lessThanMinute");
}
