import { describe, expect, it } from "vitest";
import { formatRaw, formatTimeLeft, shortAddr, ton } from "../src/utils/format";

describe("format.ton", () => {
  it("converts nano TON bigint to TON decimal string", () => {
    expect(ton(0n)).toBe("0");
    expect(ton(1_000_000_000n)).toBe("1");
    expect(ton(1_500_000_000n)).toBe("1.5");
  });
});

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
