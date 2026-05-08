import type { SupportedLanguage } from "@toncast/sdk";

export type Device = "mobile" | "tablet" | "desktop";

export interface ThemeColorSet {
  accent: string;
  bg: string;
}

export interface ThemeConfig {
  colorScheme: "light" | "dark" | "system";
  radius: number;
  /** Grid columns: 0 = auto (responsive), 1–4 = fixed count */
  columns: number;
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
    light: { accent: DEFAULT_ACCENT, bg: "" },
    dark: { accent: DEFAULT_ACCENT, bg: "" },
  },
};
