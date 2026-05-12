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
   * Toncast REST API base URL used by `@toncast/sdk`.
   * Defaults to the public Toncast API.
   */
  baseUrl?: string;
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

export type ToncastWidgetDensity = "compact" | "default" | "comfortable";

export interface ToncastWidgetGridLayout {
  /** Columns below 480px. Defaults to 1. */
  mobile?: number;
  /** Columns from 480px to 759px. Defaults to 2. */
  tablet?: number;
  /** Columns from 760px upward. Defaults to 3. */
  desktop?: number;
}

export interface ToncastWidgetLayout {
  /** Responsive pari-card grid columns. */
  grid?: ToncastWidgetGridLayout;
}

export interface ToncastWidgetDerivedCssVarsOptions {
  /** Derive foreground/background/hover variables from accent/success/danger/warn. Defaults to true. */
  colors?: boolean;
  /** Derive spacing variables from cssVars.density. Defaults to true. */
  density?: boolean;
}

/**
 * Base CSS custom property overrides (applied regardless of theme).
 *
 * **Color format note:** semantic derivation (fg, bg, border, hover, shadow, etc.)
 * only works for 3- or 6-digit hex strings (`#rgb` / `#rrggbb`). Non-hex values
 * (`rgb()`, `hsl()`, `var(--host-color)`) are applied directly to the primary token
 * (`--tc-accent`, `--tc-bg`, …) but derived companion tokens are left unset and
 * fall back to the widget stylesheet defaults.
 */
export interface ToncastWidgetCssVarsBase {
  /** Primary accent color — buttons, links, highlights. Default: #0098ea. Hex only for derivation. */
  accent?: string;
  /** Text color rendered on accent-filled controls. Derived from accent when omitted. */
  accentFg?: string;
  /** Subtle accent background for active badges/highlights. Derived from accent when omitted. */
  accentBg?: string;
  /** Hover/darker variant of accent. Defaults to accent when accent is set. */
  accentHover?: string;
  /** Accent-colored shadow for primary controls. Derived from accent when omitted. */
  accentShadow?: string;
  /** Widget root background. Default: #ffffff (light) / #0f172a (dark). Hex only for derivation. */
  bg?: string;
  /** Header/nav chrome background. Derived from bg when omitted. */
  bgChrome?: string;
  /** Card/panel background. Default: #f8fafc (light) / #1e293b (dark) */
  bgCard?: string;
  /** Muted/subtle background. Default: #f1f5f9 (light) / #1e293b (dark) */
  bgMuted?: string;
  /** Hover/subtle overlay background. Derived from bg when omitted. */
  bgHover?: string;
  /** Primary text color. Default: #1e293b (light) / #f1f5f9 (dark) */
  fg?: string;
  /** Muted text color. Default: #64748b (light) / #94a3b8 (dark) */
  fgMuted?: string;
  /** Border color. Default: #e2e8f0 (light) / #334155 (dark) */
  border?: string;
  /** Border-radius for cards and buttons. Default: 12px */
  radius?: string;
  /** Box-shadow for card hover states. Matches the `--tc-shadow` CSS variable. */
  shadow?: string;
  /** Semantic positive color used by YES buttons, won badges, and positive chart/order-book states. */
  success?: string;
  /** Text color for positive surfaces. Derived from success when omitted. */
  successFg?: string;
  /** Subtle positive background. Derived from success when omitted. */
  successBg?: string;
  /** Positive border color for notices/outcomes. Derived from success when omitted. */
  successBorder?: string;
  /** Positive hover background. Derived from success when omitted. */
  successHoverBg?: string;
  /** Positive selected/active background. Derived from success when omitted. */
  successActiveBg?: string;
  /** Positive selected/active border. Derived from success when omitted. */
  successActiveBorder?: string;
  /** Positive selected/active shadow. Derived from success when omitted. */
  successActiveShadow?: string;
  /** Positive order-book fill background. Derived from success when omitted. */
  successFillBg?: string;
  /** Semantic negative color used by NO buttons, lost badges, and negative chart/order-book states. */
  danger?: string;
  /** Text color for negative surfaces. Derived from danger when omitted. */
  dangerFg?: string;
  /** Subtle negative background. Derived from danger when omitted. */
  dangerBg?: string;
  /** Negative border color for notices/outcomes. Derived from danger when omitted. */
  dangerBorder?: string;
  /** Negative hover background. Derived from danger when omitted. */
  dangerHoverBg?: string;
  /** Negative selected/active background. Derived from danger when omitted. */
  dangerActiveBg?: string;
  /** Negative selected/active border. Derived from danger when omitted. */
  dangerActiveBorder?: string;
  /** Negative selected/active shadow. Derived from danger when omitted. */
  dangerActiveShadow?: string;
  /** Negative order-book fill background. Derived from danger when omitted. */
  dangerFillBg?: string;
  /**
   * Semantic warning color used by warnings, pending states, and preview-only notices.
   * Unlike success/danger, there is no extended hover/active/fill token family for warnings by design.
   */
  warn?: string;
  /** Warning text color. Derived from warn when omitted. */
  warnFg?: string;
  /** Subtle warning background. Derived from warn when omitted. */
  warnBg?: string;
  /** Warning border color for notices. Derived from warn when omitted. */
  warnBorder?: string;
  /** Density preset that derives spacing variables. */
  density?: ToncastWidgetDensity;
  /** Main scrollable content padding. Derived from density when omitted. */
  contentPadding?: string;
  /** Standard card/form padding. Derived from density when omitted. */
  cardPadding?: string;
  /** Grid/list card gap. Derived from density when omitted. */
  cardGap?: string;
  /** Gap between form rows in betting UI. Derived from density when omitted. */
  formGap?: string;
  /** Header vertical padding. Derived from density when omitted. */
  headerPaddingY?: string;
  /** Header horizontal padding. Derived from density when omitted. */
  headerPaddingX?: string;
  /** Bottom nav vertical padding. Derived from density when omitted. */
  navPaddingY?: string;
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
    /** Responsive layout settings. */
    layout?: ToncastWidgetLayout;
    /**
     * Controls whether semantic colors and density source tokens generate
     * derived CSS variables. Defaults to true for both groups.
     * Explicit cssVars always take precedence over generated values.
     */
    deriveCssVars?: boolean | ToncastWidgetDerivedCssVarsOptions;
    referral?: {
      /**
       * Beneficiary TON wallet in user-friendly form (`UQ…` / `EQ…`), as accepted by the SDK client.
       * The widget passes this through to Toncast; invalid addresses may fail at quote or send time.
       */
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
  };
}

export type ToncastWidgetEventMap = {
  mount: { container: Element };
  unmount: undefined;
  /**
   * Payload is the thrown value when a **user-registered** listener for `mount`,
   * `unmount`, or `bet` throws. This is not a general channel for React/SDK/UI errors.
   */
  error: unknown;
  bet: { pariId: string; amount: bigint; side: "yes" | "no" };
};
