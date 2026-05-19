import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import widgetIifeCss from "@toncast/widget/styles/widget.css?raw";
import { describe, expect, it } from "vitest";
import { minifyWidgetCss } from "../src/utils/minifyWidgetCss";

const widgetCssPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/widget/src/styles/widget.css",
);

describe("minifyWidgetCss", () => {
  it("shrinks widget.css and strips banner comments", () => {
    const source = readFileSync(widgetCssPath, "utf8");
    const minified = minifyWidgetCss(source);

    expect(minified.length).toBeLessThan(source.length * 0.75);
    expect(minified).not.toContain("/* =====");
    expect(minified).toContain(".tc-w");
  });

  it("vite ?raw import is minified for ZIP export", () => {
    expect(widgetIifeCss).not.toContain("/* =====");
    expect(widgetIifeCss.length).toBeLessThan(readFileSync(widgetCssPath, "utf8").length);
  });
});
