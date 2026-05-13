import { fromNano } from "@ton/core";

/** Thrown when a string like `35.572` cannot be parsed safely for the locale. */
export class AmbiguousLocalizedDecimalError extends Error {
  readonly name = "AmbiguousLocalizedDecimalError";
  constructor(message = "ambiguous-localized-decimal") {
    super(message);
  }
}

/**
 * Locale-aware TON amount formatting.
 *
 * Falls back to the raw `fromNano` string when:
 * - the value overflows `Number.MAX_SAFE_INTEGER` (≥ ~9 quadrillion nano = 9 M TON);
 * - `Intl.NumberFormat` rejects the locale tag (defensive — `lang` is a BCP-47 from `useI18n`).
 */
export function formatTon(
  nano: bigint,
  lang: string,
  opts: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {},
): string {
  const raw = fromNano(nano);
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  try {
    return new Intl.NumberFormat(lang, {
      maximumFractionDigits: opts.maximumFractionDigits ?? 9,
      minimumFractionDigits: opts.minimumFractionDigits ?? 0,
      useGrouping: true,
    }).format(num);
  } catch {
    return raw;
  }
}

/**
 * Plain (locale-agnostic) raw bigint → decimal string. Kept for stable IO into
 * `<input>` (decimal point is the parser's expected separator). Use
 * {@link formatRawLocalized} for display.
 */
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

/** Locale-aware variant of {@link formatRaw} for display only. */
export function formatRawLocalized(
  amount: bigint,
  decimals: number,
  lang: string,
  maxFracDigits = 6,
): string {
  const plain = formatRaw(amount, decimals, maxFracDigits);
  const num = Number(plain);
  if (!Number.isFinite(num)) return plain;
  try {
    return new Intl.NumberFormat(lang, {
      maximumFractionDigits: maxFracDigits,
      useGrouping: true,
    }).format(num);
  } catch {
    return plain;
  }
}

/**
 * Inspects `Intl.NumberFormat(lang)` to find the locale's group and decimal
 * separators. Both fall back to the canonical `","` / `"."` when the runtime
 * rejects the BCP-47 tag. Internal helper for {@link parseLocalizedDecimal} —
 * not part of the public API.
 */
function localeNumberSeparators(lang: string): {
  decimal: string;
  group: string;
} {
  try {
    const parts = new Intl.NumberFormat(lang).formatToParts(1234567.89);
    const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
    const group = parts.find((p) => p.type === "group")?.value ?? "";
    return { decimal, group };
  } catch {
    return { decimal: ".", group: "" };
  }
}

/**
 * Normalises a locale-formatted decimal string into a `.`-decimal canonical
 * form suitable for `parseUnits` — strips group separators and unifies the
 * decimal mark. Whitespace (incl. NBSP / NNBSP grouping) is dropped too.
 *
 * Idempotent: passing an already-canonical `"35.572"` returns `"35.572"` for
 * locales that use `.` as the decimal separator (e.g. `en-US`).
 *
 * For locales where the decimal separator is **not** `.` (e.g. `de-DE`), a
 * lone `.` with exactly three digits after it is **ambiguous** (English-style
 * fraction vs. thousands grouping) and throws {@link AmbiguousLocalizedDecimalError}.
 */
export function parseLocalizedDecimal(input: string, lang: string): string {
  const { decimal, group } = localeNumberSeparators(lang);
  let s = input.trim();

  if (decimal !== "." && !s.includes(decimal) && s.includes(".")) {
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount === 1) {
      const dot = s.indexOf(".");
      const left = s.slice(0, dot);
      const right = s.slice(dot + 1);
      if (/^\d+$/.test(left) && /^\d+$/.test(right) && right.length === 3) {
        throw new AmbiguousLocalizedDecimalError();
      }
    }
  }

  if (group) s = s.split(group).join("");
  // Browsers may render the group separator as NBSP / NNBSP irrespective of
  // the locale tag — strip both unconditionally so manual edits round-trip.
  s = s.replace(/[\s\u00a0\u202f]/g, "");
  if (decimal !== ".") s = s.split(decimal).join(".");
  return s;
}

/** Locale-aware `Number.toFixed`-style formatter (e.g. `×1.50`, `82%`). */
export function formatDecimal(
  value: number,
  lang: string,
  opts: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {},
): string {
  if (!Number.isFinite(value)) return String(value);
  try {
    return new Intl.NumberFormat(lang, {
      maximumFractionDigits: opts.maximumFractionDigits ?? 2,
      minimumFractionDigits: opts.minimumFractionDigits ?? opts.maximumFractionDigits ?? 2,
      useGrouping: true,
    }).format(value);
  } catch {
    return value.toFixed(opts.maximumFractionDigits ?? 2);
  }
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

/**
 * Returns a localised "time remaining" string. The translator `t` is required —
 * call-sites running outside the widget must supply a stub (see tests).
 */
export function formatTimeLeft(
  endTime: number,
  t: TimeLeftTranslate,
  now: number = Date.now(),
): string {
  const remaining = Math.floor(endTime - now / 1000);
  if (remaining <= 0) return t("time.ended");
  const d = Math.floor(remaining / 86_400);
  const h = Math.floor((remaining % 86_400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  if (d > 0) return t("time.daysHours", { d, h });
  if (h > 0) return t("time.hoursMinutes", { h, m });
  if (m > 0) return t("time.minutes", { m });
  return t("time.lessThanMinute");
}
