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
  /** Must be top-level: tsup's postcss plugin reads `options.loader[".css"]`, not `esbuildOptions`. */
  loader: { ".css": "text" },
  noExternal: [/.*/],
  esbuildOptions(options) {
    options.legalComments = "none";
  },
  outExtension() {
    return { js: ".js" };
  },
});
