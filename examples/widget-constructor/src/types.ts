import type { SupportedLanguage } from "@toncast/sdk";

export type Device = "mobile" | "tablet" | "desktop";

export interface ThemeColorSet {
  accent: string;
  bg: string;
  success: string;
  danger: string;
  warn: string;
}

export interface ThemeConfig {
  colorScheme: "light" | "dark" | "system";
  radius: number;
  /** Grid columns: 0 = auto (responsive), 1–4 = fixed count */
  columns: number;
  density: "compact" | "default" | "comfortable";
  /** Colors applied in light mode */
  light: ThemeColorSet;
  /** Colors applied in dark mode */
  dark: ThemeColorSet;
}

export interface ConstructorConfig {
  domain: string;
  /** App name shown in tonconnect-manifest.json */
  appName: string;
  /** Icon URL shown in tonconnect-manifest.json (square PNG ≥ 180×180) */
  iconUrl: string;
  /** Default language for the widget. Empty string = auto-detect. */
  language: SupportedLanguage | "";
  /** Languages available in the widget's in-app picker. Empty = show all. */
  languages: SupportedLanguage[];
  referralAddress: string;
  referralPct: number;
  theme: ThemeConfig;
}

export const DEFAULT_ACCENT = "#0098ea";
export const DEFAULT_LIGHT_COLORS: ThemeColorSet = {
  accent: DEFAULT_ACCENT,
  bg: "",
  success: "#16a34a",
  danger: "#dc2626",
  warn: "#d97706",
};
export const DEFAULT_DARK_COLORS: ThemeColorSet = {
  accent: DEFAULT_ACCENT,
  bg: "",
  success: "#22c55e",
  danger: "#f87171",
  warn: "#f59e0b",
};

export const DEFAULT_CONFIG: ConstructorConfig = {
  domain: "",
  appName: "",
  iconUrl: "",
  language: "",
  languages: [],
  referralAddress: "",
  referralPct: 0,
  theme: {
    colorScheme: "light",
    radius: 12,
    columns: 0,
    density: "default",
    light: DEFAULT_LIGHT_COLORS,
    dark: DEFAULT_DARK_COLORS,
  },
};
