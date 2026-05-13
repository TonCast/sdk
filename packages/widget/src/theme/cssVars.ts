import type { CSSProperties } from "react";
import type {
  ToncastWidgetConfig,
  ToncastWidgetCssVars,
  ToncastWidgetCssVarsBase,
  ToncastWidgetLayout,
} from "../types";
import { deriveCssVars } from "./cssVarBuilder";

type StyleVars = Record<string, string>;
type DeriveOptions = NonNullable<
  ToncastWidgetConfig["widget"]
>["deriveCssVars"];

const DEFAULT_GRID_LAYOUT = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
} as const;

function normalizeColumns(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(6, Math.trunc(value)));
}

/** Maps breakpoint grid density to pari card compact layout variables. */
function applyPariCardLayoutVars(
  device: "mobile" | "tablet",
  shouldStack: boolean,
  style: StyleVars,
): void {
  const prefix = `--tc-pari-${device}`;
  style[`${prefix}-meta-direction`] = shouldStack ? "column" : "row";
  style[`${prefix}-meta-align`] = shouldStack ? "flex-start" : "center";
  style[`${prefix}-meta-justify`] = shouldStack
    ? "flex-start"
    : "space-between";
  style[`${prefix}-meta-gap`] = shouldStack ? "2px" : "8px";
  style[`${prefix}-actions-columns`] = shouldStack ? "1fr" : "1fr 1fr";
  style[`${prefix}-actions-gap`] = shouldStack ? "4px" : "6px";
  style[`${prefix}-actions-font-size`] = shouldStack ? "11px" : "12px";
}

function applyLayoutVars(
  layout: ToncastWidgetLayout | undefined,
  style: StyleVars,
): void {
  const grid = layout?.grid;
  if (!grid) return;

  const mobileColumns = normalizeColumns(
    grid.mobile,
    DEFAULT_GRID_LAYOUT.mobile,
  );
  const tabletColumns = normalizeColumns(
    grid.tablet,
    DEFAULT_GRID_LAYOUT.tablet,
  );
  const desktopColumns = normalizeColumns(
    grid.desktop,
    DEFAULT_GRID_LAYOUT.desktop,
  );

  style["--tc-grid-mobile"] = String(mobileColumns);
  style["--tc-grid-tablet"] = String(tabletColumns);
  style["--tc-grid-desktop"] = String(desktopColumns);
  applyPariCardLayoutVars("mobile", mobileColumns > 1, style);
  applyPariCardLayoutVars("tablet", tabletColumns > 3, style);
}

export function buildCssVarStyle(
  vars: ToncastWidgetCssVars | undefined,
  effectiveTheme: "light" | "dark",
  deriveOptions: DeriveOptions,
  layout?: ToncastWidgetLayout,
): CSSProperties | undefined {
  if (!vars && !layout?.grid) return undefined;

  // Merge base vars with active-theme overrides into one effective set BEFORE
  // derivation. Strip `light` / `dark` from the spread so `effective` is a flat
  // ToncastWidgetCssVarsBase (no stray nested objects on the merged object).
  let style: StyleVars = {};
  if (vars) {
    const { light, dark, ...rest } = vars;
    const themeOverrides = effectiveTheme === "dark" ? dark : light;
    const effective: ToncastWidgetCssVarsBase = themeOverrides
      ? { ...rest, ...themeOverrides }
      : rest;

    style = deriveCssVars(effective, effectiveTheme, deriveOptions);
  }
  applyLayoutVars(layout, style);

  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}
