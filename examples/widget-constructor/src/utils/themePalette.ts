import { safeHexColor } from "@toncast/widget/color-math";
import type { ThemeColorSet } from "../types";

/**
 * Semantic palette for `deriveCssVars` when the user set a custom shell `bg`.
 * Returns `null` when bg is empty — widget keeps `_tokens.css` defaults.
 */
export function themePaletteForDerivation(colors: ThemeColorSet): Record<string, string> | null {
  const explicitBg = colors.bg?.trim() ? safeHexColor(colors.bg) : null;
  if (!explicitBg) return null;

  const palette: Record<string, string> = { bg: explicitBg };
  const accent = safeHexColor(colors.accent);
  const success = safeHexColor(colors.success);
  const danger = safeHexColor(colors.danger);
  const warn = safeHexColor(colors.warn);
  if (accent) palette.accent = accent;
  if (success) palette.success = success;
  if (danger) palette.danger = danger;
  if (warn) palette.warn = warn;

  const fg = colors.fg?.trim() ? safeHexColor(colors.fg) : null;
  if (fg) palette.fg = fg;
  const fgMuted = colors.fgMuted?.trim() ? safeHexColor(colors.fgMuted) : null;
  if (fgMuted) palette.fgMuted = fgMuted;
  const border = colors.border?.trim() ? safeHexColor(colors.border) : null;
  if (border) palette.border = border;

  return palette;
}
