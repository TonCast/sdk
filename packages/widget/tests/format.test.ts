import { describe, expect, it } from "vitest";
import {
  AmbiguousLocalizedDecimalError,
  formatDecimal,
  formatRaw,
  formatRawLocalized,
  formatTimeLeft,
  formatTon,
  parseLocalizedDecimal,
  shortAddr,
} from "../src/utils/format";

// describe("format.ton", () => {
//   it("converts nano TON bigint to TON decimal string", () => {
//     expect(ton(0n)).toBe("0");
//     expect(ton(1_000_000_000n)).toBe("1");
//     expect(ton(1_500_000_000n)).toBe("1.5");
//   });
// });

describe("format.formatRaw", () => {
  it("returns whole when fractional is zero", () => {
    expect(formatRaw(5_000_000_000n, 9)).toBe("5");
  });

  it("trims trailing zeros from fractional part", () => {
    expect(formatRaw(1_500_000_000n, 9)).toBe("1.5");
  });

  it("respects maxFracDigits", () => {
    expect(formatRaw(1_234_567_890n, 9, 2)).toBe("1.23");
    expect(formatRaw(1_234_567_890n, 9, 4)).toBe("1.2345");
  });

  it("handles zero amount", () => {
    expect(formatRaw(0n, 9)).toBe("0");
  });

  it("pads short fractional with leading zeros (when maxFracDigits allows)", () => {
    expect(formatRaw(1n, 9, 9)).toBe("0.000000001");
    // default maxFracDigits=6 truncates the small value to 0
    expect(formatRaw(1n, 9)).toBe("0");
  });
});

describe("format.shortAddr", () => {
  it("shortens long addresses", () => {
    const addr = "EQABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
    expect(shortAddr(addr)).toBe("EQABCD…3456");
  });

  it("keeps short addresses untouched", () => {
    expect(shortAddr("EQABCDE")).toBe("EQABCDE");
  });

  it("respects custom head/tail lengths", () => {
    expect(shortAddr("0xABCDEF1234567890", 4, 4)).toBe("0xAB…7890");
  });
});

describe("format.formatTon (locale-aware)", () => {
  it("groups thousands per locale", () => {
    // 1234 TON = 1234 * 1e9 nano. Whole number, no fraction.
    expect(formatTon(1_234n * 1_000_000_000n, "en-US")).toBe("1,234");
    // de-DE uses dot as thousands separator. Use \u202f-tolerant containment.
    expect(formatTon(1_234n * 1_000_000_000n, "de-DE")).toMatch(/^1[.\u202f]234$/);
  });

  it("preserves fractional part with locale separators", () => {
    expect(formatTon(1_234_500_000n, "en-US")).toBe("1.2345");
    // de-DE → comma as decimal separator
    expect(formatTon(1_234_500_000n, "de-DE")).toBe("1,2345");
  });

  it("falls back gracefully on bogus locale", () => {
    // The platform may either accept the tag (modern Node) or throw — in both
    // cases we get a usable string instead of a crash.
    expect(formatTon(1_500_000_000n, "definitely-not-a-locale")).toMatch(/1[.,]5/);
  });
});

describe("format.formatRawLocalized", () => {
  it("keeps locale separators and obeys maxFracDigits", () => {
    expect(formatRawLocalized(1_234_500_000n, 9, "en-US", 4)).toBe("1.2345");
    expect(formatRawLocalized(1_234_500_000n, 9, "de-DE", 4)).toBe("1,2345");
  });
});

describe("format.parseLocalizedDecimal", () => {
  it("is a no-op for canonical .-decimal input in dot-decimal locales", () => {
    expect(parseLocalizedDecimal("35.572", "en-US")).toBe("35.572");
  });

  it("throws for ambiguous dot form in comma-decimal locales", () => {
    expect(() => parseLocalizedDecimal("35.572", "de-DE")).toThrow(AmbiguousLocalizedDecimalError);
    expect(() => parseLocalizedDecimal("35.572", "ru-RU")).toThrow(AmbiguousLocalizedDecimalError);
    expect(() => parseLocalizedDecimal("1.234", "de-DE")).toThrow(AmbiguousLocalizedDecimalError);
  });

  it("converts comma-decimal locales back to .-decimal", () => {
    expect(parseLocalizedDecimal("35,572", "ru-RU")).toBe("35.572");
    expect(parseLocalizedDecimal("35,572", "de-DE")).toBe("35.572");
  });

  it("strips locale group separators (incl. NBSP / NNBSP)", () => {
    // ru-RU groups with U+00A0 (NBSP) → "1\u00a0234,5"
    expect(parseLocalizedDecimal("1\u00a0234,5", "ru-RU")).toBe("1234.5");
    // de-DE groups with "."
    expect(parseLocalizedDecimal("1.234.567,89", "de-DE")).toBe("1234567.89");
    // en-US groups with ","
    expect(parseLocalizedDecimal("1,234.5", "en-US")).toBe("1234.5");
  });
});

describe("format.formatDecimal", () => {
  it("formats numbers with locale separators and fraction control", () => {
    // maximumFractionDigits caps decimals but does NOT add trailing zeros (minimumFractionDigits defaults to 0)
    expect(formatDecimal(1234.5, "en-US", { maximumFractionDigits: 2 })).toBe("1,234.5");
    expect(formatDecimal(1234.5, "de-DE", { maximumFractionDigits: 2 })).toMatch(
      /^1[.\u202f]234,5$/,
    );
    // setting both min and max forces trailing zeros
    expect(formatDecimal(1234.5, "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe("1,234.50");
    expect(formatDecimal(1.234, "en-US", { maximumFractionDigits: 0 })).toBe("1");
  });

  it("returns the raw string for non-finite input", () => {
    expect(formatDecimal(Number.NaN, "en-US")).toBe("NaN");
    expect(formatDecimal(Number.POSITIVE_INFINITY, "en-US")).toBe("Infinity");
  });
});

describe("format.formatTimeLeft", () => {
  const NOW = 1_700_000_000_000;
  const sec = (s: number) => Math.floor(NOW / 1000) + s;

  /** English-prose translator stub mirroring the prior built-in fallback. */
  const en = (key: string, vars?: Record<string, number>): string => {
    switch (key) {
      case "time.ended":
        return "ended";
      case "time.daysHours":
        return `${vars?.d ?? 0}d ${vars?.h ?? 0}h`;
      case "time.hoursMinutes":
        return `${vars?.h ?? 0}h ${vars?.m ?? 0}m`;
      case "time.minutes":
        return `${vars?.m ?? 0}m`;
      case "time.lessThanMinute":
        return "< 1m";
      default:
        return key;
    }
  };

  it("emits 'ended' when remaining ≤ 0", () => {
    expect(formatTimeLeft(sec(-10), en as never, NOW)).toBe("ended");
  });

  it("formats days+hours", () => {
    const t = sec(2 * 86_400 + 3 * 3600);
    expect(formatTimeLeft(t, en as never, NOW)).toBe("2d 3h");
  });

  it("formats hours+minutes", () => {
    const t = sec(3 * 3600 + 15 * 60);
    expect(formatTimeLeft(t, en as never, NOW)).toBe("3h 15m");
  });

  it("formats minutes", () => {
    expect(formatTimeLeft(sec(15 * 60), en as never, NOW)).toBe("15m");
  });

  it("formats < 1m", () => {
    expect(formatTimeLeft(sec(30), en as never, NOW)).toBe("< 1m");
  });

  it("delegates key + vars to translator (translator is now required)", () => {
    const t = (key: string, vars?: Record<string, number>) =>
      `(${key}:${JSON.stringify(vars ?? {})})`;
    expect(formatTimeLeft(sec(15 * 60), t as never, NOW)).toBe('(time.minutes:{"m":15})');
  });
});
