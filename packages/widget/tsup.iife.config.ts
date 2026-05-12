import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageDir = dirname(fileURLToPath(import.meta.url));

/** CDN IIFE → `window.ToncastWidget`; bundles deps, CSS as strings (see `ToncastWidget.ts`). */
export default defineConfig({
  entry: { "index.iife": "src/index.ts" },
  format: ["iife"],
  globalName: "ToncastWidget",
  outDir: "dist",
  minify: true,
  sourcemap: false,
  target: "es2020",
  platform: "browser",
  noExternal: [/.*/],
  esbuildOptions(options) {
    options.loader = { ...options.loader, ".css": "text" };
    options.legalComments = "none";
  },
  onSuccess: async () => {
    await rm(resolve(packageDir, "dist/index.iife.css"), { force: true });
  },
  outExtension() {
    return { js: ".js" };
  },
});
