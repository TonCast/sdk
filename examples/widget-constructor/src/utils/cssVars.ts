import type { ToncastWidgetCssVars, ToncastWidgetCssVarsBase } from "@toncast/widget";
import { safeHexColor } from "@toncast/widget/color-math";
import { RADIUS_DEFAULT } from "@toncast/widget/constants";
import {
  type ConstructorConfig,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  type ThemeColorSet,
} from "../types";
import { clampRadius } from "./normalizeConfig";
import { WIDGET_SHELL_BG } from "./themeDefaults";

/**
 * Builds a "delta palette" containing only colors that differ from defaults.
 * The widget's runtime defaults already cover unchanged values, so we emit
 * overrides only for what the user actually changed (smaller style.css).
 */
function buildDeltaPalette(
  colors: ThemeColorSet,
  defaults: ThemeColorSet,
  mode: "light" | "dark",
): ToncastWidgetCssVarsBase {
  const palette: ToncastWidgetCssVarsBase = {};
  const accent = safeHexColor(colors.accent);
  const bg = colors.bg ? safeHexColor(colors.bg) : null;
  const success = safeHexColor(colors.success);
  const danger = safeHexColor(colors.danger);
  const warn = safeHexColor(colors.warn);
  const fg = colors.fg ? safeHexColor(colors.fg) : null;
  const fgMuted = colors.fgMuted ? safeHexColor(colors.fgMuted) : null;
  const border = colors.border ? safeHexColor(colors.border) : null;
  if (accent !== null && accent !== defaults.accent) palette.accent = accent;
  const canonicalBg = WIDGET_SHELL_BG[mode];
  const defaultBgRaw = defaults.bg?.trim() ? safeHexColor(defaults.bg) : canonicalBg;
  if (bg !== null && defaultBgRaw !== null && bg.toLowerCase() !== defaultBgRaw.toLowerCase()) {
    palette.bg = bg;
  }
  if (success !== null && success !== defaults.success) palette.success = success;
  if (danger !== null && danger !== defaults.danger) palette.danger = danger;
  if (warn !== null && warn !== defaults.warn) palette.warn = warn;
  if (fg !== null && fg !== (defaults.fg ? safeHexColor(defaults.fg) : null)) palette.fg = fg;
  if (fgMuted !== null && fgMuted !== (defaults.fgMuted ? safeHexColor(defaults.fgMuted) : null))
    palette.fgMuted = fgMuted;
  if (border !== null && border !== (defaults.border ? safeHexColor(defaults.border) : null))
    palette.border = border;
  return palette;
}

function paletteOrNull(
  colors: ThemeColorSet,
  defaults: ThemeColorSet,
  mode: "light" | "dark",
): ToncastWidgetCssVarsBase | null {
  const palette = buildDeltaPalette(colors, defaults, mode);
  return Object.keys(palette).length > 0 ? palette : null;
}

/**
 * Builds the `widget.cssVars` object for JS/React configs (semantic colors, radius, density).
 *
 * Return shape depends on `theme.colorScheme`:
 * - `"light"` / `"dark"`: a **flat** object — only the active palette keys are merged at the top
 *   level (e.g. `{ accent: "#...", bg: "#..." }`).
 * - `"system"`: when both palettes need overrides, returns **`light` and `dark` sub-objects**
 *   so runtime can pick by OS preference (`{ light: { ... }, dark: { ... } }`).
 *
 * Returns `undefined` when nothing differs from defaults (no overrides to emit).
 */
export function buildCssVarsConfig(config: ConstructorConfig): ToncastWidgetCssVars | undefined {
  const { theme } = config;
  const radius = clampRadius(theme.radius);

  const vars: ToncastWidgetCssVars = {};

  if (radius !== RADIUS_DEFAULT) vars.radius = `${radius}px`;
  if (theme.density !== "default") vars.density = theme.density;

  const lightVars = paletteOrNull(theme.light, DEFAULT_LIGHT_COLORS, "light");
  const darkVars = paletteOrNull(theme.dark, DEFAULT_DARK_COLORS, "dark");

  if (theme.colorScheme === "light") {
    if (lightVars) Object.assign(vars, lightVars);
  } else if (theme.colorScheme === "dark") {
    if (darkVars) Object.assign(vars, darkVars);
  } else {
    // System: emit per-theme sub-objects so each mode gets its own palette
    if (lightVars) vars.light = lightVars;
    if (darkVars) vars.dark = darkVars;
  }

  return Object.keys(vars).length > 0 ? vars : undefined;
}
