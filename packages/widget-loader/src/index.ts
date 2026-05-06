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

export type ToncastWidgetConstructor = new (config: ToncastWidgetConfig) => ToncastWidgetInstance;

export interface ToncastWidgetConfig {
  tonconnect:
    | {
        type: "standalone";
        options: { domain: string };
      }
    | {
        type: "integrated";
        // biome-ignore lint/suspicious/noExplicitAny: TonConnectUI type from peer dep
        instance: any;
      };
  client?:
    | {
        type: "standalone";
      }
    | {
        type: "integrated";
        // biome-ignore lint/suspicious/noExplicitAny: ToncastClient type from peer dep
        instance: any;
      };
  widget?: {
    language?: string;
    theme?: "light" | "dark";
    referral?: { address: string; pct: number };
  };
}

export interface ToncastWidgetInstance {
  mount(container: Element): void;
  unmount(): void;
  on(event: "mount", listener: (payload: { container: Element }) => void): this;
  on(event: "unmount", listener: () => void): this;
  on(event: "error", listener: (err: unknown) => void): this;
  on(
    event: "bet",
    listener: (payload: { pariId: string; amount: bigint; side: "yes" | "no" }) => void,
  ): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
}

/** CDN URL template — major-versioned for non-breaking auto-updates. */
const CDN_URL = "https://widget.toncast.app/v0/index.iife.js";

let cachedConstructor: ToncastWidgetConstructor | null = null;
let pendingPromise: Promise<ToncastWidgetConstructor> | null = null;

/**
 * Download and cache the Toncast widget bundle from CDN.
 * Subsequent calls return the cached constructor without re-fetching.
 */
async function load(cdnUrl: string = CDN_URL): Promise<ToncastWidgetConstructor> {
  if (cachedConstructor) return cachedConstructor;
  if (pendingPromise) return pendingPromise;

  pendingPromise = (async () => {
    await injectScript(cdnUrl);

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
  })();

  return pendingPromise;
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-tc-widget-loader="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.setAttribute("data-tc-widget-loader", src);
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`[ToncastWidgetLoader] Failed to load bundle from ${src}`));
    document.head.appendChild(el);
  });
}

const ToncastWidgetLoader = { load };
export default ToncastWidgetLoader;
