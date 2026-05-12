import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "scripts", "bundle-widget-css.mjs");

describe("widget.css bundle", () => {
  it("is in sync with src/styles/_*.css source modules", () => {
    expect(() => {
      execSync(`node ${SCRIPT} --check`, { stdio: "pipe" });
    }).not.toThrow();
  });
});
