import type { SupportedLanguage } from "@toncast/sdk";

export type Device = "mobile" | "tablet" | "desktop";

export interface ThemeConfig {
  colorScheme: "light" | "dark" | "system";
  accent: string;
  bg: string;
  radius: number;
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
    accent: "#0098ea",
    bg: "",
    radius: 12,
  },
};
