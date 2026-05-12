export type SupportedLanguage = "en" | "ru" | "hi" | "es" | "zh" | "fr" | "de" | "pt" | "fa" | "ar";

export type ToncastWidgetDensity = "compact" | "default" | "comfortable";

export interface ToncastWidgetGridLayout {
  mobile?: number;
  tablet?: number;
  desktop?: number;
}

export interface ToncastWidgetLayout {
  grid?: ToncastWidgetGridLayout;
}

export interface ToncastWidgetDerivedCssVarsOptions {
  /** Derive foreground/background/hover variables from accent/success/danger/warn. Defaults to true. */
  colors?: boolean;
  /** Derive spacing variables from cssVars.density. Defaults to true. */
  density?: boolean;
}

export interface ToncastWidgetCssVarsBase {
  accent?: string;
  accentFg?: string;
  accentBg?: string;
  accentHover?: string;
  accentShadow?: string;
  bg?: string;
  bgChrome?: string;
  bgCard?: string;
  bgMuted?: string;
  bgHover?: string;
  fg?: string;
  fgMuted?: string;
  border?: string;
  radius?: string;
  shadow?: string;
  success?: string;
  successFg?: string;
  successBg?: string;
  successBorder?: string;
  successHoverBg?: string;
  successActiveBg?: string;
  successActiveBorder?: string;
  successActiveShadow?: string;
  successFillBg?: string;
  danger?: string;
  dangerFg?: string;
  dangerBg?: string;
  dangerBorder?: string;
  dangerHoverBg?: string;
  dangerActiveBg?: string;
  dangerActiveBorder?: string;
  dangerActiveShadow?: string;
  dangerFillBg?: string;
  warn?: string;
  warnFg?: string;
  warnBg?: string;
  warnBorder?: string;
  density?: ToncastWidgetDensity;
  contentPadding?: string;
  cardPadding?: string;
  cardGap?: string;
  formGap?: string;
  headerPaddingY?: string;
  headerPaddingX?: string;
  navPaddingY?: string;
}

export interface ToncastWidgetCssVars extends ToncastWidgetCssVarsBase {
  light?: ToncastWidgetCssVarsBase;
  dark?: ToncastWidgetCssVarsBase;
}

export interface ToncastWidgetConfig<
  TonConnectInstance = unknown,
  ToncastClientInstance = unknown,
> {
  tonconnect:
    | { type: "standalone"; options: { domain: string } }
    | {
        type: "integrated";
        instance: TonConnectInstance;
      };
  client?:
    | {
        type: "standalone";
        baseUrl?: string;
        endpoint?: string;
        apiKey?: string;
        network?: "mainnet" | "testnet";
      }
    | {
        type: "integrated";
        instance: ToncastClientInstance;
      };
  widget?: {
    language?: SupportedLanguage;
    theme?: "light" | "dark" | "system";
    cssVars?: ToncastWidgetCssVars;
    layout?: ToncastWidgetLayout;
    deriveCssVars?: boolean | ToncastWidgetDerivedCssVarsOptions;
    referral?: { address: string; pct: number };
    languages?: SupportedLanguage[];
    onBet?: (pariId: string, amount: bigint, side: "yes" | "no") => void;
  };
}

export type ToncastWidgetEventMap = {
  mount: { container: Element };
  unmount: undefined;
  error: unknown;
  bet: { pariId: string; amount: bigint; side: "yes" | "no" };
};
