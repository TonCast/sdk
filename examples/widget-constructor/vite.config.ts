import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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
      "@toncast/widget/color-math": resolve(
        __dirname,
        "../../packages/widget/src/theme/colorMath.ts",
      ),
      "@toncast/widget/css-vars-builder": resolve(
        __dirname,
        "../../packages/widget/src/theme/cssVarBuilder.ts",
      ),
      "@toncast/widget/url": resolve(__dirname, "../../packages/widget/src/utils/url.ts"),
      "@toncast/widget/use-prefers-color-scheme-dark": resolve(
        __dirname,
        "../../packages/widget/src/utils/usePrefersColorSchemeDark.ts",
      ),
      "@toncast/widget/constants": resolve(__dirname, "../../packages/widget/src/constants.ts"),
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
      "@ton/core",
      "@ston-fi/sdk",
      "@ston-fi/api",
      "@toncast/tx-sdk",
      "axios",
      "zod",
    ],
  },
});
