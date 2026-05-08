import type { ToncastWidgetCssVarsBase, ToncastWidgetDensity } from "../types";

/** Keys derived from the density preset into `--tc-*` spacing variables. */
export type DensitySpacingPick = Pick<
  ToncastWidgetCssVarsBase,
  | "contentPadding"
  | "cardPadding"
  | "cardGap"
  | "formGap"
  | "headerPaddingY"
  | "headerPaddingX"
  | "navPaddingY"
>;

/**
 * Spacing presets for `cssVars.density` — single source of truth for the widget
 * engine and for static CSS export (e.g. widget-constructor `style.css`).
 */
export const WIDGET_DENSITY_PRESETS: Record<ToncastWidgetDensity, DensitySpacingPick> = {
  compact: {
    contentPadding: "10px",
    cardPadding: "10px",
    cardGap: "8px",
    formGap: "10px",
    headerPaddingY: "6px",
    headerPaddingX: "10px",
    navPaddingY: "7px",
  },
  default: {
    contentPadding: "12px",
    cardPadding: "14px",
    cardGap: "10px",
    formGap: "12px",
    headerPaddingY: "8px",
    headerPaddingX: "12px",
    navPaddingY: "10px",
  },
  comfortable: {
    contentPadding: "16px",
    cardPadding: "18px",
    cardGap: "14px",
    formGap: "16px",
    headerPaddingY: "10px",
    headerPaddingX: "16px",
    navPaddingY: "12px",
  },
};

const FIELD_TO_CSS_VAR: Record<keyof DensitySpacingPick, string> = {
  contentPadding: "--tc-content-padding",
  cardPadding: "--tc-card-padding",
  cardGap: "--tc-card-gap",
  formGap: "--tc-form-gap",
  headerPaddingY: "--tc-header-padding-y",
  headerPaddingX: "--tc-header-padding-x",
  navPaddingY: "--tc-nav-padding-y",
};

/** Turns a density preset into `--tc-*` entries for flat CSS (ZIP `style.css`). */
export function densityPresetToCssCustomProperties(
  preset: DensitySpacingPick,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(FIELD_TO_CSS_VAR) as Array<keyof DensitySpacingPick>) {
    const v = preset[key];
    if (v != null && v !== "") out[FIELD_TO_CSS_VAR[key]] = v;
  }
  return out;
}
