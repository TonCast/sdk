/**
 * @toncast/widget-loader
 *
 * Lightweight npm package that downloads the Toncast widget CDN bundle at
 * runtime and returns the `ToncastWidget` constructor.
 *
 * Usage (React + integrated TonConnect):
 * ```tsx
 * import ToncastWidgetLoader, { type ToncastWidgetInstance } from '@toncast/widget-loader';
 * import { useTonConnectUI } from '@tonconnect/ui-react';
 * import { useEffect, useRef } from 'react';
 *
 * function ToncastWidget() {
 *   const [tonconnect] = useTonConnectUI();
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const widgetRef = useRef<ToncastWidgetInstance | null>(null);
 *
 *   useEffect(() => {
 *     let active = true;
 *     ToncastWidgetLoader.load().then((Widget) => {
 *       if (!active || !containerRef.current) return;
 *       widgetRef.current = new Widget({
 *         tonconnect: { type: 'integrated', instance: tonconnect },
 *       });
 *       widgetRef.current.mount(containerRef.current);
 *     });
 *     return () => { active = false; widgetRef.current?.unmount(); };
 *   }, [tonconnect]);
 *
 *   return <div ref={containerRef} style={{ width: '100%' }} />;
 * }
 * ```
 */

/**
 * Re-declared here because `widget-loader` is a CDN-only package with no dependency
 * on `@toncast/sdk`. Keep this union in sync with `SupportedLanguage` in that package
 * whenever a new language is added.
 */
export type SupportedLanguage = "en" | "ru" | "hi" | "es" | "zh" | "fr" | "de" | "pt" | "fa" | "ar";

export type ToncastWidgetConstructor = new (config: ToncastWidgetConfig) => ToncastWidgetInstance;

export type ToncastWidgetDensity = "compact" | "default" | "comfortable";

export interface ToncastWidgetDerivedCssVarsOptions {
  /** Derive foreground/background/hover variables from accent/success/danger/warn. Defaults to true. */
  colors?: boolean;
  /** Derive spacing variables from cssVars.density. Defaults to true. */
  density?: boolean;
}

/** Base CSS custom property overrides (applied regardless of theme). */
export interface ToncastWidgetCssVarsBase {
  /** Primary accent color — buttons, links, highlights. Default: #0098ea */
  accent?: string;
  /** Text color rendered on accent-filled controls. Derived from accent when omitted. */
  accentFg?: string;
  /** Subtle accent background for active badges/highlights. Derived from accent when omitted. */
  accentBg?: string;
  /** Hover/darker variant of accent. Defaults to accent when accent is set. */
  accentHover?: string;
  /** Accent-colored shadow for primary controls. Derived from accent when omitted. */
  accentShadow?: string;
  /** Widget root background. Default: #ffffff (light) / #0f172a (dark) */
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
  /**
   * Overrides the pari grid column layout. Accepts any valid CSS `grid-template-columns` value.
   * Example: `"repeat(2, 1fr)"` — forces 2 columns.
   * Omit to use the default responsive auto-fill layout.
   */
  gridCols?: string;
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
  /** Semantic warning color used by warnings, pending states, and preview-only notices. */
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

/** CSS custom property overrides for per-instance theming. */
export interface ToncastWidgetCssVars extends ToncastWidgetCssVarsBase {
  /** Overrides applied only in light mode (takes precedence over base vars). */
  light?: ToncastWidgetCssVarsBase;
  /** Overrides applied only in dark mode (takes precedence over base vars). */
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
        /** Existing TonConnectUI instance from your app. */
        instance: TonConnectInstance;
      };
  client?:
    | {
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
      }
    | {
        type: "integrated";
        /** Existing ToncastClient instance from your app. */
        instance: ToncastClientInstance;
      };
  widget?: {
    language?: SupportedLanguage;
    /**
     * "light" / "dark" — locked palette. "system" — follows OS prefers-color-scheme.
     * Defaults to "light" when omitted.
     */
    theme?: "light" | "dark" | "system";
    /** Override CSS custom properties for per-instance theming. */
    cssVars?: ToncastWidgetCssVars;
    /**
     * Controls whether semantic colors and density source tokens generate derived CSS variables.
     * Defaults to true for both groups. Explicit cssVars always win.
     */
    deriveCssVars?: boolean | ToncastWidgetDerivedCssVarsOptions;
    referral?: { address: string; pct: number };
    /**
     * Languages shown in the in-widget language picker.
     * Omit to show all supported languages.
     * Pass [] to hide the picker entirely.
     */
    languages?: SupportedLanguage[];
    /** Called when the user successfully sends a bet transaction. */
    onBet?: (pariId: string, amount: bigint, side: "yes" | "no") => void;
  };
}

export interface ToncastWidgetInstance {
  mount(container: Element): void;
  unmount(): void;
  /**
   * Re-render the widget with an updated config without unmounting.
   * Changes to `endpoint`, `apiKey`, `network`, `language`, or `referral` will
   * create a fresh ToncastClient — a brief loading state will appear.
   * Purely visual changes (theme, cssVars, …) are applied instantly.
   * Safe to call before `mount()`.
   */
  update(config: ToncastWidgetConfig): void;
  on(event: "mount", listener: (payload: { container: Element }) => void): this;
  on(event: "unmount", listener: () => void): this;
  on(event: "error", listener: (err: unknown) => void): this;
  on(
    event: "bet",
    listener: (payload: { pariId: string; amount: bigint; side: "yes" | "no" }) => void,
  ): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
}

export interface ToncastWidgetLoaderOptions {
  /**
   * Subresource Integrity hash for the CDN bundle.
   * When set without `crossOrigin`, the loader uses `anonymous`.
   */
  integrity?: string;
  /** Cross-origin mode for SRI/CORS-enabled script loading. */
  crossOrigin?: "" | "anonymous" | "use-credentials";
  /** CSP nonce to attach to the injected script element. */
  nonce?: string;
}

/** CDN URL template — major-versioned for non-breaking auto-updates. */
const CDN_URL = "https://widget.toncast.app/v0/index.iife.js";

let cachedConstructor: ToncastWidgetConstructor | null = null;
let pendingPromise: Promise<ToncastWidgetConstructor> | null = null;

/**
 * Download and cache the Toncast widget bundle from CDN.
 * Subsequent calls return the cached constructor without re-fetching.
 */
async function load(
  cdnUrl: string = CDN_URL,
  options: ToncastWidgetLoaderOptions = {},
): Promise<ToncastWidgetConstructor> {
  if (cachedConstructor) return cachedConstructor;
  if (pendingPromise) return pendingPromise;

  pendingPromise = (async () => {
    await injectScript(cdnUrl, options);

    // The IIFE sets window.ToncastWidget = { ToncastWidget: [class] }
    // biome-ignore lint/suspicious/noExplicitAny: global set by CDN bundle
    const g = globalThis as any;
    const ctor: ToncastWidgetConstructor = g.ToncastWidget?.ToncastWidget ?? g.ToncastWidget;

    if (typeof ctor !== "function") {
      throw new Error(
        "[ToncastWidgetLoader] CDN bundle loaded but window.ToncastWidget is not a constructor. " +
          "Check the CDN URL or bundle version.",
      );
    }

    cachedConstructor = ctor;
    return ctor;
  })().catch((err) => {
    pendingPromise = null;
    throw err;
  });

  return pendingPromise;
}

function injectScript(src: string, options: ToncastWidgetLoaderOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (findLoaderScript(src)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    if (options.integrity) {
      el.integrity = options.integrity;
      el.crossOrigin = options.crossOrigin ?? "anonymous";
    } else if (options.crossOrigin !== undefined) {
      el.crossOrigin = options.crossOrigin;
    }
    if (options.nonce) el.nonce = options.nonce;
    el.setAttribute("data-tc-widget-loader", src);
    el.onload = () => resolve();
    el.onerror = () => {
      el.remove();
      reject(new Error(`[ToncastWidgetLoader] Failed to load bundle from ${src}`));
    };
    document.head.appendChild(el);
  });
}

function findLoaderScript(src: string): HTMLScriptElement | null {
  for (const el of Array.from(document.scripts)) {
    if (el.getAttribute("data-tc-widget-loader") === src) return el;
  }
  return null;
}

const ToncastWidgetLoader = { load };
export default ToncastWidgetLoader;
