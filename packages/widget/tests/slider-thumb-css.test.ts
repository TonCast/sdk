import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const controlsCssPath = join(__dirname, "..", "src", "styles", "_controls.css");

describe("Radix slider thumb CSS", () => {
  it("centres the horizontal thumb with translateY on the inner handle, not --radix-slider-thumb-transform !important", async () => {
    const css = await readFile(controlsCssPath, "utf8");

    expect(css).not.toMatch(/--radix-slider-thumb-transform:\s*[^;]+!important/);
    expect(css).toContain('.tc-slider-root[data-orientation="horizontal"] .tc-slider-thumb');
    expect(css).toContain("transform: translateY(-50%)");
    expect(css).toContain("translateY(-50%) scale(1.12)");
  });
});
