import { describe, expect, it } from "vitest";
import { DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS } from "../src/types";
import { effectiveAdvancedColors } from "../src/utils/effectiveAdvancedColors";

describe("effectiveAdvancedColors", () => {
  it("returns widget dark defaults when palette matches shell defaults", () => {
    const colors = { ...DEFAULT_DARK_COLORS, bg: "" };
    const r = effectiveAdvancedColors(colors, "dark");
    expect(r.fg).toBe("#e2e8f0");
    expect(r.fgMuted).toBe("#94a3b8");
    expect(r.border).toBe("#2d3f55");
  });

  it("derives fg from custom dark background", () => {
    const colors = { ...DEFAULT_DARK_COLORS, bg: "#000000" };
    const r = effectiveAdvancedColors(colors, "dark");
    expect(r.fg).toBe("#ffffff");
    expect(r.fgMuted).toMatch(/^#/);
  });

  it("returns light defaults for light mode", () => {
    const colors = { ...DEFAULT_LIGHT_COLORS, bg: "" };
    const r = effectiveAdvancedColors(colors, "light");
    expect(r.fg).toBe("#1e293b");
    expect(r.fgMuted).toBe("#64748b");
  });
});
