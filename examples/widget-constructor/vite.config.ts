import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // @ton/core, @ston-fi/sdk, axios etc. reach for Node built-ins at module-init time.
    nodePolyfills({
      include: ["stream", "buffer", "events", "util", "process", "crypto"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  resolve: {
    alias: {
      // Subpath before package root — `@toncast/widget` alone maps to `src/index.ts` via folder.
      "@toncast/widget/density-presets": resolve(
        __dirname,
        "../../packages/widget/src/theme/densityPresets.ts",
      ),
      // Resolve workspace packages from source so Vite always uses fresh code.
      "@toncast/widget": resolve(__dirname, "../../packages/widget/src"),
      "@toncast/sdk-react": resolve(__dirname, "../../packages/sdk-react/src"),
      "@toncast/sdk": resolve(__dirname, "../../packages/sdk/src"),
    },
  },
  optimizeDeps: {
    include: [
      "@tanstack/react-query",
      "@tonconnect/ui-react",
      "@radix-ui/react-slider",
      "@radix-ui/react-select",
      "@radix-ui/react-dialog",
      "@ton/core",
      "@ton/ton",
      "@ston-fi/sdk",
      "@ston-fi/api",
      "@toncast/tx-sdk",
      "axios",
      "zod",
    ],
  },
});
