import { defineConfig } from "tsup";

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
  outExtension() {
    return { js: ".js" };
  },
});
