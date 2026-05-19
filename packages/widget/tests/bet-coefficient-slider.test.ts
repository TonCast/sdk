import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentPath = join(__dirname, "..", "src", "components", "bet", "BetCoefficientSlider.tsx");
const layoutHelpersPath = join(__dirname, "..", "src", "styles", "_layout-helpers.css");

/** Guards layout/CSS from drifting away from product rules for limit vs fixed. */
describe("BetCoefficientSlider", () => {
  it("renders green fill only in limit mode and always maps liquidity markers", async () => {
    const src = await readFile(componentPath, "utf8");

    expect(src).toMatch(/bet\.mode\s*===\s*["']limit["']/);
    expect(src).toContain("tc-coef-slider-fill");
    expect(src).toContain("bet.liquidityMarkers.map");
    expect(src).not.toMatch(/bet\.mode\s*===\s*["']fixed["'][\s\S]*tc-coef-slider-fill/);
    const markersBlock = src.slice(src.indexOf("bet.liquidityMarkers.map"));
    expect(markersBlock.slice(0, 400)).not.toMatch(/bet\.mode\s*===\s*["']limit["']/);
  });

  it("keeps the coefficient track translucent so the underlay is visible", async () => {
    const css = await readFile(layoutHelpersPath, "utf8");
    expect(css).toContain(".tc-coef-slider-wrap .tc-slider-track");
    expect(css).toContain("color-mix(in srgb, var(--tc-bg-muted)");
  });
});
