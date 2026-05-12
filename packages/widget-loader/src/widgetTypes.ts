/**
 * Public widget types **duplicated** from `@toncast/widget` so this loader can
 * typecheck and build before the widget package emits `dist/*.d.ts`.
 *
 * Drift detection: `tests/types-contract.test.ts` asserts structural equality
 * with `@toncast/widget`'s exports — keep both in sync in the same release.
 */

export type SupportedLanguage = "en" | "ru" | "hi" | "es" | "zh" | "fr" | "de" | "pt" | "fa" | "ar";

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
 * (`--tc-accent`, `--tc-bg`, …) but derived companion tokens fall back to the
 * widget stylesheet defaults.
 */
export interface ToncastWidgetCssVarsBase {
  /** Primary accent color — buttons, links, highlights. Default: #0098ea. Hex only for derivation. */
  accent?: string;
  /** Text color rendered on accent-filled controls. Derived from accent when omitted. */
  accentFg?: string;
  /** Subtle accent background for active badges/highlights. Derived from accent when omitted. */
  accentBg?: string;
  /** Hover/darker variant of accent. Derived from accent when omitted. */
  accentHover?: string;
  /** Accent-colored shadow for primary controls. Derived from accent when omitted. */
  accentShadow?: string;
  /** Widget root background. Default: #ffffff (light) / #0f172a (dark). Hex only for derivation. */
  bg?: string;
  /** Header/nav chrome background. Derived from bg when omitted. */
  bgChrome?: string;
  /** Card/panel background. Derived from bg when omitted. */
  bgCard?: string;
  /** Muted/subtle background. Derived from bg when omitted. */
  bgMuted?: string;
  /** Hover/subtle overlay background. Derived from bg when omitted. */
  bgHover?: string;
  /** Primary text color. Derived from bg when omitted. */
  fg?: string;
  /** Muted text color. Derived from bg when omitted. */
  fgMuted?: string;
  /** Border color. Derived from bg when omitted. */
  border?: string;
  /** Border-radius for cards and buttons. Default: 12px */
  radius?: string;
  /** Box-shadow for card hover states. Matches the `--tc-shadow` CSS variable. */
  shadow?: string;
  /** Semantic positive color used by YES buttons, won badges, positive chart/order-book states. */
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
  /** Semantic negative color used by NO buttons, lost badges, negative chart/order-book states. */
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
   * Semantic warning color used by warnings, pending states, preview-only notices.
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
  /** Overrides applied only when the effective theme is "light". Wins over base vars. */
  light?: ToncastWidgetCssVarsBase;
  /** Overrides applied only when the effective theme is "dark". Wins over base vars. */
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
        wsUrl?: string;
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
    /**
     * Visual theme.
     * - "light" / "dark" — locked to that palette.
     * - "system" — follows the OS `prefers-color-scheme` media query.
     * Defaults to "light" when omitted.
     */
    theme?: "light" | "dark" | "system";
    /**
     * When `theme` is `"system"`, used as the server snapshot for `prefers-color-scheme`
     * (React `useSyncExternalStore`) so SSR markup matches the intended first paint.
     * Forward from `Sec-CH-Prefers-Color-Scheme`, a cookie, or your framework request context.
     * Defaults to `"light"` on the server when omitted.
     */
    ssrColorScheme?: "light" | "dark";
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
    referral?: { address: string; pct: number };
    /**
     * Languages shown in the in-widget language picker.
     * Omit (or pass undefined) to show all supported languages.
     * Pass an empty array `[]` to hide the picker entirely.
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
