export type Device = "mobile" | "tablet" | "desktop";

export interface ThemeConfig {
  colorScheme: "light" | "dark";
  accent: string;
  bg: string;
  radius: number;
}

export interface ConstructorConfig {
  domain: string;
  /** Default language for the widget */
  language: string;
  /** Languages available in the widget's in-app picker. Empty = show all. */
  languages: string[];
  referralAddress: string;
  referralPct: number;
  theme: ThemeConfig;
}

export const DEFAULT_CONFIG: ConstructorConfig = {
  domain: "",
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
