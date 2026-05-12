import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageDir = dirname(fileURLToPath(import.meta.url));

// ESM + CJS build (for npm / widget-loader integration)
export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react.ts",
    "density-presets": "src/theme/densityPresets.ts",
    "color-math": "src/theme/colorMath.ts",
    "css-vars-builder": "src/theme/cssVarBuilder.ts",
    url: "src/utils/url.ts",
    "use-prefers-color-scheme-dark": "src/utils/usePrefersColorSchemeDark.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  platform: "browser",
  loader: { ".css": "text" },
  onSuccess: async () => {
    await mkdir(resolve(packageDir, "dist"), { recursive: true });
    await copyFile(
      resolve(packageDir, "src/styles/widget.css"),
      resolve(packageDir, "dist/index.css"),
    );
  },
  external: [
    "react",
    "react-dom",
    "@toncast/sdk",
    "@toncast/sdk-react",
    "@tanstack/react-query",
    "@tonconnect/ui-react",
  ],
});
