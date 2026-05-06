import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

const externalDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  /^node:/,
];

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Browser-targetted React lib — no node-only inlining.
  platform: "neutral",
  external: externalDeps,
});
