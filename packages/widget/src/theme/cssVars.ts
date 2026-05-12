import type { CSSProperties } from "react";
import type {
  ToncastWidgetConfig,
  ToncastWidgetCssVars,
  ToncastWidgetCssVarsBase,
  ToncastWidgetLayout,
} from "../types";
import { deriveCssVars } from "./cssVarBuilder";

type StyleVars = Record<string, string>;
type DeriveOptions = NonNullable<ToncastWidgetConfig["widget"]>["deriveCssVars"];

const DEFAULT_GRID_LAYOUT = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
} as const;

function normalizeColumns(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(6, Math.trunc(value)));
}

function applyLayoutVars(layout: ToncastWidgetLayout | undefined, style: StyleVars): void {
  const grid = layout?.grid;
  if (!grid) return;

  style["--tc-grid-mobile"] = String(normalizeColumns(grid.mobile, DEFAULT_GRID_LAYOUT.mobile));
  style["--tc-grid-tablet"] = String(normalizeColumns(grid.tablet, DEFAULT_GRID_LAYOUT.tablet));
  style["--tc-grid-desktop"] = String(normalizeColumns(grid.desktop, DEFAULT_GRID_LAYOUT.desktop));
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
