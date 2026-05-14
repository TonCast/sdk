import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pariCssPath = join(__dirname, "..", "src", "styles", "_pari.css");

describe("pari card responsive CSS", () => {
  it("keeps the grid configurable while applying compact card layout from variables", async () => {
    const css = await readFile(pariCssPath, "utf8");

    expect(css).toContain("grid-template-columns: repeat(var(--tc-grid-mobile), minmax(0, 1fr));");
    expect(css).toContain("@container (max-width: 479px)");
    expect(css).toContain("@container (min-width: 480px) and (max-width: 759px)");
    expect(css).toContain("flex-direction: var(--tc-pari-mobile-meta-direction, row);");
    expect(css).toContain("grid-template-columns: var(--tc-pari-mobile-actions-columns, 1fr 1fr);");
    expect(css).toContain("flex-direction: var(--tc-pari-tablet-meta-direction, row);");
    expect(css).toContain("grid-template-columns: var(--tc-pari-tablet-actions-columns, 1fr 1fr);");
    expect(css).not.toContain("grid-column: 2;");
  });

  it("renders compact pari meta as wrap-safe chips (chrome not gated on shell 759px)", async () => {
    const css = await readFile(pariCssPath, "utf8");

    expect(css).not.toContain("@container (max-width: 759px)");
    expect(css).toContain("flex-wrap: wrap;");
    expect(css).toContain(".tc-pari-meta-item {");
    expect(css).toContain("background: var(--tc-bg-muted);");
    expect(css).toContain("border: 1px solid var(--tc-border);");
    expect(css).toContain("border-radius: 999px;");
    expect(css).toContain("padding: 2px 6px;");
  });
});
