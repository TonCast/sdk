import { deriveCssVars } from "@toncast/widget/css-vars-builder";
import type { ThemeColorSet } from "../types";
import { WIDGET_ADVANCED_DEFAULTS } from "./themeDefaults";
import { themePaletteForDerivation } from "./themePalette";

export interface EffectiveAdvancedColors {
  fg: string;
  fgMuted: string;
  border: string;
}

/** Resolves fg / fgMuted / border for ThemeTab Advanced preview. */
export function effectiveAdvancedColors(
  colors: ThemeColorSet,
  mode: "light" | "dark",
): EffectiveAdvancedColors {
  const fallbacks = WIDGET_ADVANCED_DEFAULTS[mode];
  const palette = themePaletteForDerivation(colors);
  if (!palette) return { ...fallbacks };

  const vars = deriveCssVars(palette, mode);
  return {
    fg: vars["--tc-fg"] ?? fallbacks.fg,
    fgMuted: vars["--tc-fg-muted"] ?? fallbacks.fgMuted,
    border: vars["--tc-border"] ?? fallbacks.border,
  };
}
