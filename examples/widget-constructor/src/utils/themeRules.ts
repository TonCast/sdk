import type { Device, ThemeConfig } from "../types";

export type ConstructorThemeChoice = "light" | "dark";

export interface ThemeSelection {
  light: boolean;
  dark: boolean;
}

export const GRID_COLUMN_OPTIONS_BY_DEVICE = {
  mobile: [1, 2, 3],
  tablet: [2, 3, 4, 5],
  desktop: [3, 4, 5, 6],
} as const satisfies Record<Device, readonly number[]>;

export const GRID_COLUMN_DEFAULTS = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
} as const satisfies Record<Device, number>;

function nearestAllowedColumn(value: number, allowed: readonly number[]): number {
  return allowed.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
  );
}

export function normalizeGridColumnForDevice(device: Device, raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return GRID_COLUMN_DEFAULTS[device];
  return nearestAllowedColumn(Math.round(n), GRID_COLUMN_OPTIONS_BY_DEVICE[device]);
}

export function colorSchemeToThemeSelection(
  colorScheme: ThemeConfig["colorScheme"],
): ThemeSelection {
  return {
    light: colorScheme !== "dark",
    dark: colorScheme !== "light",
  };
}

export function selectionToColorScheme(selection: ThemeSelection): ThemeConfig["colorScheme"] {
  if (selection.light && selection.dark) return "system";
  if (selection.dark) return "dark";
  return "light";
}

export function toggleThemeSelection(
  selection: ThemeSelection,
  choice: ConstructorThemeChoice,
): ThemeSelection {
  const next = { ...selection, [choice]: !selection[choice] };
  if (!next.light && !next.dark) return selection;
  return next;
}
