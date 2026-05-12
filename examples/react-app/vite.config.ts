import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// `@toncast/sdk` pulls in axios + @ston-fi/sdk which reach for `node:stream`
// (and a couple more node built-ins) at module-init time. Browser builds need
// the polyfilled shims; otherwise Vite throws "Readable is not exported".
//
// Two fixes needed:
//   1. nodePolyfills() — provides browser shims for stream/buffer/events/util/process
//   2. optimizeDeps.include — forces esbuild to pre-bundle the CJS-flavoured
//      tsup output (which sprinkles dynamic `require()` calls for node modules
//      that Vite's esm bundler can't resolve at runtime).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ["stream", "buffer", "events", "util", "process", "crypto"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  optimizeDeps: {
    // Workspace packages — if listed in `include`, esbuild caches a snapshot at first
    // dev start; `npm run build` in packages/* doesn't invalidate that cache, so you'd
    // keep stale `pariCoverUrl` etc. until `rm -rf node_modules/.vite`. Excluding linked
    // packages makes Vite always resolve fresh output from dist/.
    exclude: ["@toncast/sdk", "@toncast/sdk-react"],
    include: [
      "@toncast/tx-sdk",
      "@ston-fi/sdk",
      "@ston-fi/api",
      "@ton/core",
      "@tanstack/react-query",
      "axios",
      "zod",
    ],
  },
});
