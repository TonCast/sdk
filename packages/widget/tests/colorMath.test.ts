import { describe, expect, it } from "vitest";
import {
  isLightColor,
  mix,
  parseHexColor,
  readableFg,
  relativeLuminance,
  rgba,
  safeHexColor,
} from "../src/theme/colorMath";

describe("colorMath.parseHexColor", () => {
  it("expands 3-digit hex (#fff → [255,255,255])", () => {
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
    expect(parseHexColor("#000")).toEqual([0, 0, 0]);
    expect(parseHexColor("#abc")).toEqual([170, 187, 204]);
  });

  it("parses 6-digit hex (#ffffff → [255,255,255])", () => {
    expect(parseHexColor("#ffffff")).toEqual([255, 255, 255]);
    expect(parseHexColor("#000000")).toEqual([0, 0, 0]);
    expect(parseHexColor("#0098ea")).toEqual([0, 152, 234]);
  });

  it("is case-insensitive", () => {
    expect(parseHexColor("#FfAa00")).toEqual([255, 170, 0]);
    expect(parseHexColor("#FFF")).toEqual([255, 255, 255]);
  });

  it("trims surrounding whitespace", () => {
    expect(parseHexColor("  #fff  ")).toEqual([255, 255, 255]);
  });

  it("returns null for invalid input", () => {
    expect(parseHexColor("xyz")).toBeNull();
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("rgb(1,2,3)")).toBeNull();
    expect(parseHexColor("#ggg")).toBeNull();
    expect(parseHexColor("ffffff")).toBeNull(); // missing #
    expect(parseHexColor("#fffff")).toBeNull(); // 5 chars
    expect(parseHexColor("#fffffff")).toBeNull(); // 7 chars
  });
});

describe("colorMath.safeHexColor", () => {
  it("returns trimmed valid hex as-is (3 or 6 digit)", () => {
    expect(safeHexColor("#fff")).toBe("#fff");
    expect(safeHexColor("#FFFFFF")).toBe("#FFFFFF");
    expect(safeHexColor("  #0098ea  ")).toBe("#0098ea");
  });

  it("returns null for invalid hex / empty / non-hex schemes", () => {
    expect(safeHexColor("")).toBeNull();
    expect(safeHexColor("not-hex")).toBeNull();
    expect(safeHexColor("#xyz")).toBeNull();
    expect(safeHexColor("rgb(0,0,0)")).toBeNull();
    expect(safeHexColor("#fffff")).toBeNull();
  });
});

describe("colorMath.rgba", () => {
  it("emits rgba() string for valid hex", () => {
    expect(rgba("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(rgba("#000000", 1)).toBe("rgba(0, 0, 0, 1)");
    expect(rgba("#0098ea", 0.35)).toBe("rgba(0, 152, 234, 0.35)");
  });

  it("returns null for invalid hex", () => {
    expect(rgba("xyz", 0.5)).toBeNull();
    expect(rgba("", 0.5)).toBeNull();
  });

  it("does not validate alpha range — passes value through verbatim", () => {
    // Caller responsibility; documents existing behaviour (prevents accidental clamp).
    expect(rgba("#fff", 1.5)).toBe("rgba(255, 255, 255, 1.5)");
    expect(rgba("#fff", -0.1)).toBe("rgba(255, 255, 255, -0.1)");
  });
});

describe("colorMath.relativeLuminance", () => {
  it("0 for pure black, 1 for pure white", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("monotonically increases with brightness", () => {
    const dark = relativeLuminance([20, 20, 20]);
    const mid = relativeLuminance([128, 128, 128]);
    const light = relativeLuminance([200, 200, 200]);
    expect(dark).toBeLessThan(mid);
    expect(mid).toBeLessThan(light);
  });
});

describe("colorMath.isLightColor", () => {
  it("returns true for light surfaces, false for dark ones", () => {
    expect(isLightColor("#ffffff")).toBe(true);
    expect(isLightColor("#f8fafc")).toBe(true);
    expect(isLightColor("#000000")).toBe(false);
    expect(isLightColor("#0f172a")).toBe(false);
  });

  it("returns false for invalid hex (no rgb to compute)", () => {
    expect(isLightColor("not-hex")).toBe(false);
    expect(isLightColor("")).toBe(false);
  });
});

describe("colorMath.readableFg", () => {
  it("picks dark fg for light bg, light fg for dark bg", () => {
    expect(readableFg("#ffffff")).toBe("#0f172a");
    expect(readableFg("#000000")).toBe("#ffffff");
    expect(readableFg("#0098ea")).toBe("#ffffff"); // medium brand accent
  });

  it("respects custom lightFg / darkFg", () => {
    expect(readableFg("#ffffff", "#111", "#eee")).toBe("#111");
    expect(readableFg("#000000", "#111", "#eee")).toBe("#eee");
  });

  it("returns null for invalid hex", () => {
    expect(readableFg("not-hex")).toBeNull();
  });
});

describe("colorMath.mix", () => {
  it("returns src when weight=0", () => {
    // weight 0 = no movement towards target → result equals normalised src
    expect(mix("#0098ea", [255, 255, 255], 0)).toBe("#0098ea");
  });

  it("returns target colour when weight=1", () => {
    expect(mix("#000000", [255, 255, 255], 1)).toBe("#ffffff");
    expect(mix("#abcdef", [0, 0, 0], 1)).toBe("#000000");
  });

  it("computes a half-mix at weight=0.5", () => {
    // (0+255)/2 = 127.5 → rounds to 128 = 0x80
    expect(mix("#000000", [255, 255, 255], 0.5)).toBe("#808080");
  });

  it("normalises mixed values to 6-digit lowercase hex", () => {
    expect(mix("#fff", [0, 0, 0], 0)).toBe("#ffffff");
    expect(mix("#abc", [0, 0, 0], 0)).toBe("#aabbcc");
  });

  it("returns null for invalid hex", () => {
    expect(mix("not-hex", [0, 0, 0], 0.5)).toBeNull();
    expect(mix("", [0, 0, 0], 0.5)).toBeNull();
  });
});
