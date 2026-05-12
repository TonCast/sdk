import { defineConfig } from "vitest/config";

/** Unit tests for demo helpers — `node` env (no DOM / React). */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
  },
});
