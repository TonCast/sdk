/**
 * @toncast/widget-loader
 *
 * Lightweight npm package that downloads the Toncast widget CDN bundle at
 * runtime and returns the `ToncastWidget` constructor.
 *
 * Types are re-exported from `@toncast/widget` so they stay aligned with the npm/CDN bundle.
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

import type { ToncastWidgetConfig, ToncastWidgetEventMap } from "@toncast/widget";

export type {
  SupportedLanguage,
  ToncastWidgetConfig,
  ToncastWidgetCssVars,
  ToncastWidgetCssVarsBase,
  ToncastWidgetDensity,
  ToncastWidgetDerivedCssVarsOptions,
  ToncastWidgetEventMap,
} from "@toncast/widget";

export type ToncastWidgetConstructor = new (config: ToncastWidgetConfig) => ToncastWidgetInstance;

type WidgetEventListener<T> = T extends void ? () => void : (payload: T) => void;

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
  off<K extends keyof ToncastWidgetEventMap>(
    event: K,
    listener: WidgetEventListener<ToncastWidgetEventMap[K]>,
  ): this;
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
