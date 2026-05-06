import { defineConfig } from "tsup";

// IIFE build for CDN distribution — bundles ALL dependencies.
// Output: dist/index.iife.js  →  window.ToncastWidget
export default defineConfig({
  entry: { "index.iife": "src/index.ts" },
  format: ["iife"],
  globalName: "ToncastWidget",
  outDir: "dist",
  minify: true,
  sourcemap: true,
  target: "es2020",
  platform: "browser",
  // Bundle every dependency so the CDN script is fully self-contained.
  noExternal: [/.*/],
  esbuildOptions(options) {
    // Embed CSS files as text strings so the widget can inject them at mount time.
    options.loader = { ...options.loader, ".css": "text" };
  },
});
