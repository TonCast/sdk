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
