import type { SupportedLanguage, ToncastClient } from "@toncast/sdk";
import type { TonConnectUI } from "@tonconnect/ui-react";

export type TcStandaloneDescriptor = {
  type: "standalone";
  options: {
    /** Your app domain — widget builds manifestUrl = domain + '/tonconnect-manifest.json' */
    domain: string;
  };
};

export type TcIntegratedDescriptor = {
  type: "integrated";
  /** Existing TonConnectUI instance from your React app */
  instance: TonConnectUI;
};

export type TonConnectDescriptor = TcStandaloneDescriptor | TcIntegratedDescriptor;

export type ClientStandaloneDescriptor = {
  type: "standalone";
  /**
   * Custom RPC endpoint for the TON client.
   * Defaults to `https://toncenter.com/api/v2/jsonRPC`.
   * **Production note**: supply your own endpoint + apiKey to avoid rate limits.
   */
  endpoint?: string;
  /** API key for the endpoint (e.g. toncenter `X-API-Key`). */
  apiKey?: string;
  /** "mainnet" | "testnet". Defaults to "mainnet". */
  network?: "mainnet" | "testnet";
};

export type ClientIntegratedDescriptor = {
  type: "integrated";
  /** Existing ToncastClient instance */
  instance: ToncastClient;
};

export type ClientDescriptor = ClientStandaloneDescriptor | ClientIntegratedDescriptor;

/** Base CSS custom property overrides (applied regardless of theme). */
export interface ToncastWidgetCssVarsBase {
  /** Primary accent color — buttons, links, highlights. Default: #0098ea */
  accent?: string;
  /** Hover/darker variant of accent. Defaults to accent when accent is set. */
  accentHover?: string;
  /** Widget root background. Default: #ffffff (light) / #0f172a (dark) */
  bg?: string;
  /** Card/panel background. Default: #f8fafc (light) / #1e293b (dark) */
  bgCard?: string;
  /** Muted/subtle background. Default: #f1f5f9 (light) / #1e293b (dark) */
  bgMuted?: string;
  /** Primary text color. Default: #1e293b (light) / #f1f5f9 (dark) */
  fg?: string;
  /** Muted text color. Default: #64748b (light) / #94a3b8 (dark) */
  fgMuted?: string;
  /** Border color. Default: #e2e8f0 (light) / #334155 (dark) */
  border?: string;
  /** Border-radius for cards and buttons. Default: 12px */
  radius?: string;
}

/** CSS custom property overrides applied inline on the widget root element. */
export interface ToncastWidgetCssVars extends ToncastWidgetCssVarsBase {
  /**
   * Overrides applied only when the effective theme is "light".
   * Takes precedence over base vars for light mode.
   */
  light?: ToncastWidgetCssVarsBase;
  /**
   * Overrides applied only when the effective theme is "dark".
   * Takes precedence over base vars for dark mode.
   */
  dark?: ToncastWidgetCssVarsBase;
}

export interface ToncastWidgetConfig {
  tonconnect: TonConnectDescriptor;
  /** Omit to create an internal ToncastClient with default API/WS URLs */
  client?: ClientDescriptor;
  widget?: {
    language?: SupportedLanguage;
    /**
     * Visual theme.
     * - "light" / "dark" — locked to that palette.
     * - "system" — follows the OS `prefers-color-scheme` media query.
     * Defaults to "light" when omitted.
     */
    theme?: "light" | "dark" | "system";
    /** Override CSS custom properties for per-instance theming. */
    cssVars?: ToncastWidgetCssVars;
    referral?: {
      /** TON wallet address receiving the referral share */
      address: string;
      /** Integer 1..7 — percent of winnings, validated on-chain as uint3 */
      pct: number;
    };
    /**
     * Languages shown in the in-widget language picker.
     * Omit (or pass undefined) to show all supported languages.
     * Pass an empty array [] to hide the picker entirely.
     */
    languages?: SupportedLanguage[];
    /** Called when the user successfully sends a bet transaction. */
    onBet?: (pariId: string, amount: bigint, side: "yes" | "no") => void;
  };
}

export type ToncastWidgetEventMap = {
  mount: { container: Element };
  unmount: undefined;
  error: unknown;
  bet: { pariId: string; amount: bigint; side: "yes" | "no" };
};
