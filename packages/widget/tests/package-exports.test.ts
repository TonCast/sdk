import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("@toncast/widget package exports", () => {
  it("publishes the React component and widget stylesheet subpaths", async () => {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      exports?: Record<string, unknown>;
    };

    expect(pkg.exports).toMatchObject({
      "./react": {
        types: "./dist/react.d.ts",
        import: "./dist/react.js",
        require: "./dist/react.cjs",
      },
      "./styles/widget.css": "./dist/index.css",
    });
  });

  it("embeds widget CSS text into the class entry build", async () => {
    const indexJs = await readFile(join(root, "dist/index.js"), "utf8");

    expect(indexJs).not.toContain("var widget_default = {}");
    expect(indexJs).toContain(".tc-w");
  });
});
