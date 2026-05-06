import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

// Externalise every runtime dependency — bundlers (Vite/webpack/esbuild
// downstream) resolve them through node_modules and emit clean ESM, instead
// of us inlining CJS-wrapped chunks that contain dynamic `require("util")`
// calls (which break browser builds).
const externalDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  // Belt & suspenders: even if a transitive dep slips through, axios's
  // node-only adapter and the Node built-ins it touches must never be inlined.
  "axios",
  /^node:/,
];

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  treeshake: true,
  splitting: false,
  // Browser-friendly: no dynamic require, no node-built-in inlining.
  platform: "neutral",
  external: externalDeps,
});
