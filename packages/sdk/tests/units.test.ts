// Tests for `parseUnits` / `formatUnits` — decimal-string ↔ raw-units
// helpers exposed at the package root.

import { describe, expect, it } from "vitest";
import { ToncastError } from "../src/errors.js";
import { formatUnits, parseUnits } from "../src/utils/units.js";

describe("parseUnits", () => {
  it("parses common decimals", () => {
    expect(parseUnits("1.66", 6)).toBe(1_660_000n);
    expect(parseUnits("0.5", 9)).toBe(500_000_000n);
    expect(parseUnits("115", 9)).toBe(115_000_000_000n);
    expect(parseUnits("32.0517", 9)).toBe(32_051_700_000n);
  });

  it("treats empty string as zero", () => {
    expect(parseUnits("", 9)).toBe(0n);
    expect(parseUnits("   ", 9)).toBe(0n);
  });

  it("normalises comma to dot", () => {
    expect(parseUnits("1,66", 6)).toBe(1_660_000n);
  });

  it("truncates extra fractional digits without rounding", () => {
    expect(parseUnits("1.123456789", 6)).toBe(1_123_456n);
    expect(parseUnits("0.999999999999", 9)).toBe(999_999_999n);
  });

  it("throws on garbage input", () => {
    expect(() => parseUnits("abc", 9)).toThrow(ToncastError);
    expect(() => parseUnits("1.2.3", 9)).toThrow(ToncastError);
    expect(() => parseUnits(".", 9)).toThrow(ToncastError);
    expect(() => parseUnits("1e9", 9)).toThrow(ToncastError);
  });

  it("validates decimals", () => {
    expect(() => parseUnits("1", -1)).toThrow(ToncastError);
    expect(() => parseUnits("1", 1.5)).toThrow(ToncastError);
  });
});

describe("formatUnits", () => {
  it("formats common decimals", () => {
    expect(formatUnits(1_660_000n, 6)).toBe("1.66");
    expect(formatUnits(500_000_000n, 9)).toBe("0.5");
    expect(formatUnits(115_000_000_000n, 9)).toBe("115");
    expect(formatUnits(0n, 9)).toBe("0");
  });

  it("trims trailing zeros", () => {
    expect(formatUnits(1_500_000n, 6)).toBe("1.5");
    expect(formatUnits(1_000_000n, 6)).toBe("1");
  });

  it("clips fractional digits to maxFracDigits", () => {
    expect(formatUnits(32_051_709_428n, 9, 4)).toBe("32.0517");
    expect(formatUnits(1_123_456_789n, 9, 2)).toBe("1.12");
    // No clipping when maxFracDigits omitted
    expect(formatUnits(32_051_709_428n, 9)).toBe("32.051709428");
  });

  it("handles negative amounts", () => {
    expect(formatUnits(-1_660_000n, 6)).toBe("-1.66");
  });

  it("is the inverse of parseUnits for canonical decimals", () => {
    const cases: [string, number][] = [
      ["1.66", 6],
      ["0.5", 9],
      ["123.456", 9],
      ["0", 9],
      ["1000000", 6],
    ];
    for (const [s, decimals] of cases) {
      expect(formatUnits(parseUnits(s, decimals), decimals)).toBe(s);
    }
  });
});
