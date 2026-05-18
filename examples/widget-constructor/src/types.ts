import type { SupportedLanguage } from "@toncast/sdk";

export type { SupportedLanguage };

import { RADIUS_DEFAULT } from "@toncast/widget/constants";

export type Device = "mobile" | "tablet" | "desktop";

export interface ThemeColorSet {
  accent: string;
  bg: string;
  success: string;
  danger: string;
  warn: string;
  /** Optional overrides (skip derivation). */
  fg?: string;
  fgMuted?: string;
  border?: string;
}

export interface ThemeGridConfig {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface ThemeConfig {
  colorScheme: "light" | "dark" | "system";
  radius: number;
  /** Responsive market-card grid columns. */
  grid: ThemeGridConfig;
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
  /** Optional Toncast REST API base URL for staging/self-hosted API environments. */
  apiBaseUrl: string;
  /**
   * Optional WebSocket origin (`wss://host`, no path). Live paris streams.
   * When empty, the SDK derives WS from `apiBaseUrl`.
   */
  apiWsUrl: string;
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
  apiBaseUrl: "",
  apiWsUrl: "",
  referralAddress: "",
  referralPct: 0,
  theme: {
    colorScheme: "light",
    radius: RADIUS_DEFAULT,
    grid: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    },
    density: "default",
    light: DEFAULT_LIGHT_COLORS,
    dark: DEFAULT_DARK_COLORS,
  },
};

/** Restore Config-tab fields to defaults without changing Theme tab. */
export function resetConfigTabToDefaults(config: ConstructorConfig): ConstructorConfig {
  return {
    ...config,
    domain: DEFAULT_CONFIG.domain,
    appName: DEFAULT_CONFIG.appName,
    iconUrl: DEFAULT_CONFIG.iconUrl,
    language: DEFAULT_CONFIG.language,
    languages: [...DEFAULT_CONFIG.languages],
    apiBaseUrl: DEFAULT_CONFIG.apiBaseUrl,
    apiWsUrl: DEFAULT_CONFIG.apiWsUrl,
    referralAddress: DEFAULT_CONFIG.referralAddress,
    referralPct: DEFAULT_CONFIG.referralPct,
  };
}
