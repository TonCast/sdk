import { defineConfig } from "tsup";

// ESM + CJS build (for npm / widget-loader integration)
export default defineConfig({
  entry: { index: "src/index.ts", react: "src/react.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  platform: "browser",
  loader: { ".css": "text" },
  external: [
    "react",
    "react-dom",
    "@toncast/sdk",
    "@toncast/sdk-react",
    "@tanstack/react-query",
    "@tonconnect/ui-react",
  ],
});
