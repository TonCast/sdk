/**
 * Single source of truth for CSS-variable derivation from a Toncast palette.
 *
 * Produces a flat `Record<cssVarName, value>` consumed by:
 * - the runtime widget (cssVars.ts → inline style on `.tc-w` root),
 * - the static export in `widget-constructor` (generateZip.ts → text CSS).
 *
 * Both consumers must stay byte-identical for a given input.
 */

import type { ToncastWidgetCssVarsBase, ToncastWidgetDerivedCssVarsOptions } from "../types";
import { isLightColor, mix, parseHexColor, readableFg, rgba } from "./colorMath";
import { WIDGET_DENSITY_PRESETS } from "./densityPresets";

export type DeriveOptions = boolean | ToncastWidgetDerivedCssVarsOptions | undefined;

type StyleVars = Record<string, string>;

/** Map of `ToncastWidgetCssVarsBase` keys → CSS custom property names. */
export const DIRECT_CSS_VAR_MAP = [
  ["--tc-accent", "accent"],
  ["--tc-accent-fg", "accentFg"],
  ["--tc-accent-bg", "accentBg"],
  ["--tc-accent-hover", "accentHover"],
  ["--tc-accent-shadow", "accentShadow"],
  ["--tc-bg", "bg"],
  ["--tc-bg-chrome", "bgChrome"],
  ["--tc-bg-card", "bgCard"],
  ["--tc-bg-muted", "bgMuted"],
  ["--tc-bg-hover", "bgHover"],
  ["--tc-fg", "fg"],
  ["--tc-fg-muted", "fgMuted"],
  ["--tc-border", "border"],
  ["--tc-radius", "radius"],
  ["--tc-shadow", "shadow"],
  ["--tc-success", "success"],
  ["--tc-success-fg", "successFg"],
  ["--tc-success-bg", "successBg"],
  ["--tc-success-border", "successBorder"],
  ["--tc-success-hover-bg", "successHoverBg"],
  ["--tc-success-active-bg", "successActiveBg"],
  ["--tc-success-active-border", "successActiveBorder"],
  ["--tc-success-active-shadow", "successActiveShadow"],
  ["--tc-success-fill-bg", "successFillBg"],
  ["--tc-danger", "danger"],
  ["--tc-danger-fg", "dangerFg"],
  ["--tc-danger-bg", "dangerBg"],
  ["--tc-danger-border", "dangerBorder"],
  ["--tc-danger-hover-bg", "dangerHoverBg"],
  ["--tc-danger-active-bg", "dangerActiveBg"],
  ["--tc-danger-active-border", "dangerActiveBorder"],
  ["--tc-danger-active-shadow", "dangerActiveShadow"],
  ["--tc-danger-fill-bg", "dangerFillBg"],
  ["--tc-warn", "warn"],
  ["--tc-warn-fg", "warnFg"],
  ["--tc-warn-bg", "warnBg"],
  ["--tc-warn-border", "warnBorder"],
  ["--tc-content-padding", "contentPadding"],
  ["--tc-card-padding", "cardPadding"],
  ["--tc-card-gap", "cardGap"],
  ["--tc-form-gap", "formGap"],
  ["--tc-header-padding-y", "headerPaddingY"],
  ["--tc-header-padding-x", "headerPaddingX"],
  ["--tc-nav-padding-y", "navPaddingY"],
] as const satisfies readonly (readonly [string, keyof ToncastWidgetCssVarsBase])[];

function deriveEnabled(options: DeriveOptions, key: keyof ToncastWidgetDerivedCssVarsOptions) {
  if (options === false) return false;
  if (options === true || options === undefined) return true;
  return options[key] !== false;
}

function put(style: StyleVars, name: string, value: string | undefined): void {
  if (value !== undefined && value !== "") style[name] = value;
}

function putIfMissing(style: StyleVars, name: string, value: string | null | undefined): void {
  if (style[name] === undefined && value !== undefined && value !== null && value !== "") {
    style[name] = value;
  }
}

function deriveColorFamily(
  style: StyleVars,
  source: string | undefined,
  vars: {
    fg: string;
    bg: string;
    border?: string;
    hoverBg?: string;
    activeBg?: string;
    activeBorder?: string;
    activeShadow?: string;
    fillBg?: string;
  },
  theme: "light" | "dark",
): void {
  if (!source) return;

  const textMixTarget: [number, number, number] = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
  const textWeight = theme === "dark" ? 0.18 : 0.2;
  const shadowColor = rgba(source, 0.35);

  putIfMissing(style, vars.fg, mix(source, textMixTarget, textWeight));
  putIfMissing(style, vars.bg, rgba(source, theme === "dark" ? 0.16 : 0.1));
  if (vars.border) {
    putIfMissing(style, vars.border, rgba(source, theme === "dark" ? 0.34 : 0.25));
  }
  if (vars.hoverBg) {
    putIfMissing(style, vars.hoverBg, rgba(source, theme === "dark" ? 0.24 : 0.18));
  }
  if (vars.activeBg) {
    putIfMissing(style, vars.activeBg, rgba(source, theme === "dark" ? 0.3 : 0.22));
  }
  if (vars.activeBorder) {
    putIfMissing(style, vars.activeBorder, rgba(source, 0.4));
  }
  if (vars.activeShadow && shadowColor) {
    putIfMissing(style, vars.activeShadow, `0 4px 12px -4px ${shadowColor}`);
  }
  if (vars.fillBg) {
    putIfMissing(style, vars.fillBg, rgba(source, theme === "dark" ? 0.44 : 0.35));
  }
}

/** Apply explicit `vars[key]` values into the matching `--tc-*` slots. */
export function applyDirectVars(vars: ToncastWidgetCssVarsBase, style: StyleVars): void {
  for (const [cssVar, key] of DIRECT_CSS_VAR_MAP) {
    put(style, cssVar, vars[key]);
  }
}

/** Apply derived (computed) variables; never overrides explicit ones already in `style`. */
export function applyDerivedVars(
  vars: ToncastWidgetCssVarsBase,
  style: StyleVars,
  effectiveTheme: "light" | "dark",
  options: DeriveOptions,
): void {
  if (deriveEnabled(options, "colors")) {
    if (vars.accent) {
      putIfMissing(style, "--tc-accent-fg", readableFg(vars.accent));
      putIfMissing(
        style,
        "--tc-accent-bg",
        rgba(vars.accent, effectiveTheme === "dark" ? 0.18 : 0.1),
      );
      const accentHoverTarget: [number, number, number] =
        effectiveTheme === "dark" ? [255, 255, 255] : [0, 0, 0];
      putIfMissing(style, "--tc-accent-hover", mix(vars.accent, accentHoverTarget, 0.1));
      const accentShadow = rgba(vars.accent, 0.55);
      if (accentShadow) {
        putIfMissing(style, "--tc-accent-shadow", `0 8px 24px -8px ${accentShadow}`);
      }
    }
    if (vars.bg) {
      const fg = readableFg(vars.bg);
      if (fg) {
        const darkBg = !isLightColor(vars.bg);
        const surfaceTarget: [number, number, number] = darkBg ? [255, 255, 255] : [15, 23, 42];
        putIfMissing(style, "--tc-fg", fg);
        const bgRgb = parseHexColor(vars.bg);
        if (bgRgb) putIfMissing(style, "--tc-fg-muted", mix(fg, bgRgb, 0.38));
        putIfMissing(style, "--tc-bg-chrome", mix(vars.bg, surfaceTarget, darkBg ? 0.1 : 0.04));
        putIfMissing(style, "--tc-bg-card", mix(vars.bg, surfaceTarget, darkBg ? 0.08 : 0.025));
        putIfMissing(style, "--tc-bg-muted", mix(vars.bg, surfaceTarget, darkBg ? 0.12 : 0.06));
        putIfMissing(style, "--tc-border", rgba(fg, darkBg ? 0.16 : 0.12));
        putIfMissing(style, "--tc-bg-hover", rgba(fg, darkBg ? 0.08 : 0.04));
      }
    }
    deriveColorFamily(
      style,
      vars.success,
      {
        fg: "--tc-success-fg",
        bg: "--tc-success-bg",
        border: "--tc-success-border",
        hoverBg: "--tc-success-hover-bg",
        activeBg: "--tc-success-active-bg",
        activeBorder: "--tc-success-active-border",
        activeShadow: "--tc-success-active-shadow",
        fillBg: "--tc-success-fill-bg",
      },
      effectiveTheme,
    );
    deriveColorFamily(
      style,
      vars.danger,
      {
        fg: "--tc-danger-fg",
        bg: "--tc-danger-bg",
        border: "--tc-danger-border",
        hoverBg: "--tc-danger-hover-bg",
        activeBg: "--tc-danger-active-bg",
        activeBorder: "--tc-danger-active-border",
        activeShadow: "--tc-danger-active-shadow",
        fillBg: "--tc-danger-fill-bg",
      },
      effectiveTheme,
    );
    deriveColorFamily(
      style,
      vars.warn,
      {
        fg: "--tc-warn-fg",
        bg: "--tc-warn-bg",
        border: "--tc-warn-border",
      },
      effectiveTheme,
    );
  }

  if (deriveEnabled(options, "density") && vars.density) {
    // Guard against invalid density (e.g. stale localStorage) that would make
    // the preset undefined.
    const preset = WIDGET_DENSITY_PRESETS[vars.density];
    if (preset) applyDirectVars(preset, style);
  }
}

/**
 * Builds a flat record of `--tc-*` CSS variables from a flattened palette
 * (already merged with theme-specific overrides). Derived variables run first;
 * explicit ones (via {@link applyDirectVars}) win.
 */
export function deriveCssVars(
  palette: ToncastWidgetCssVarsBase,
  effectiveTheme: "light" | "dark",
  options?: DeriveOptions,
): Record<string, string> {
  const style: StyleVars = {};
  applyDerivedVars(palette, style, effectiveTheme, options);
  applyDirectVars(palette, style);
  return style;
}
