import { describe, expect, it } from "vitest";
import {
  colorSchemeToThemeSelection,
  GRID_COLUMN_OPTIONS_BY_DEVICE,
  normalizeGridColumnForDevice,
  selectionToColorScheme,
  toggleThemeSelection,
} from "../src/utils/themeRules";

describe("responsive grid rules", () => {
  it("exposes only layout-safe column choices per device", () => {
    expect(GRID_COLUMN_OPTIONS_BY_DEVICE.mobile).toEqual([1, 2, 3]);
    expect(GRID_COLUMN_OPTIONS_BY_DEVICE.tablet).toEqual([2, 3, 4, 5]);
    expect(GRID_COLUMN_OPTIONS_BY_DEVICE.desktop).toEqual([3, 4, 5, 6]);
  });

  it("normalizes disallowed column counts to the nearest allowed value", () => {
    expect(normalizeGridColumnForDevice("mobile", 6)).toBe(3);
    expect(normalizeGridColumnForDevice("tablet", 1)).toBe(2);
    expect(normalizeGridColumnForDevice("tablet", 6)).toBe(5);
    expect(normalizeGridColumnForDevice("desktop", 2)).toBe(3);
  });

  it("falls back to the device default for non-finite column values", () => {
    expect(normalizeGridColumnForDevice("mobile", Number.NaN)).toBe(1);
    expect(normalizeGridColumnForDevice("tablet", Number.NaN)).toBe(2);
    expect(normalizeGridColumnForDevice("desktop", Number.NaN)).toBe(3);
  });
});

describe("theme selection rules", () => {
  it("maps the stored colorScheme to constructor Light/Dark multi-select state", () => {
    expect(colorSchemeToThemeSelection("light")).toEqual({ light: true, dark: false });
    expect(colorSchemeToThemeSelection("dark")).toEqual({ light: false, dark: true });
    expect(colorSchemeToThemeSelection("system")).toEqual({ light: true, dark: true });
  });

  it("maps Light/Dark multi-select state back to the public widget theme values", () => {
    expect(selectionToColorScheme({ light: true, dark: false })).toBe("light");
    expect(selectionToColorScheme({ light: false, dark: true })).toBe("dark");
    expect(selectionToColorScheme({ light: true, dark: true })).toBe("system");
  });

  it("does not allow deselecting the last active theme", () => {
    expect(toggleThemeSelection({ light: true, dark: false }, "light")).toEqual({
      light: true,
      dark: false,
    });
    expect(toggleThemeSelection({ light: false, dark: true }, "dark")).toEqual({
      light: false,
      dark: true,
    });
  });

  it("allows switching between one or both themes", () => {
    expect(toggleThemeSelection({ light: true, dark: false }, "dark")).toEqual({
      light: true,
      dark: true,
    });
    expect(toggleThemeSelection({ light: true, dark: true }, "light")).toEqual({
      light: false,
      dark: true,
    });
    expect(toggleThemeSelection({ light: true, dark: true }, "dark")).toEqual({
      light: true,
      dark: false,
    });
  });
});
