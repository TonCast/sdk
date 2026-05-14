/**
 * @toncast/widget-loader
 *
 * Lightweight npm package that downloads the Toncast widget CDN bundle at
 * runtime and returns the `ToncastWidget` constructor.
 *
 * Public widget types are declared locally so this loader can typecheck and build before
 * the `@toncast/widget` package has emitted its `dist/*.d.ts` files.
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
 *     return () => { active = false; widgetRef.current?.dispose(); };
 *   }, [tonconnect]);
 *
 *   return <div ref={containerRef} style={{ width: '100%' }} />;
 * }
 * ```
 */

import type { ToncastWidgetConfig, ToncastWidgetEventMap } from "./widgetTypes";

export type {
  SupportedLanguage,
  ToncastWidgetConfig,
  ToncastWidgetCssVars,
  ToncastWidgetCssVarsBase,
  ToncastWidgetDensity,
  ToncastWidgetDerivedCssVarsOptions,
  ToncastWidgetEventMap,
  ToncastWidgetGridLayout,
  ToncastWidgetLayout,
} from "./widgetTypes";

export type ToncastWidgetConstructor = new (
  config: ToncastWidgetConfig,
) => ToncastWidgetInstance;

type WidgetEventListener<T> = T extends void
  ? () => void
  : (payload: T) => void;

export interface ToncastWidgetInstance {
  mount(container: Element): void;
  unmount(): void;
  /**
   * Unmounts if still mounted and clears all `on()` listeners. Call when discarding
   * the instance; do not use the instance after `dispose()`.
   */
  dispose(): void;
  /**
   * Re-render the widget with an updated config without unmounting.
   * Changes to `baseUrl`, `wsUrl`, `endpoint`, `apiKey`, `network`, `language`, or `referral` will
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
    listener: (payload: {
      pariId: string;
      amount: bigint;
      side: "yes" | "no";
    }) => void,
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
  /**
   * Reject the load promise after this many milliseconds if the script never
   * fires `load` or `error` (DNS hangs, captive portals, broken CDN). The
   * injected `<script>` is removed on timeout so a retry can re-inject it.
   * Omit or set ≤ 0 to wait indefinitely.
   */
  timeoutMs?: number;
}

/** Major-versioned CDN base (`/v0/`, `/v1/`, …). */
const CDN_VERSION_BASE = "https://widget.toncast.app/v0";

/**
 * Default widget script on CDN. Single source of truth — re-exported as a
 * named export so host apps and tooling never hardcode the URL.
 * Also exposed on the default export object for `ToncastWidgetLoader.WIDGET_CDN_JS_URL`.
 */
export const WIDGET_CDN_JS_URL = `${CDN_VERSION_BASE}/index.iife.js`;

const CDN_URL = WIDGET_CDN_JS_URL;

/** Attribute storing the loader cache key so duplicate URLs with different SRI/nonce do not reuse the wrong script. */
const LOADER_KEY_ATTR = "data-tc-widget-loader-key";

function normalizeCrossOrigin(
  v: ToncastWidgetLoaderOptions["crossOrigin"],
): string {
  return v === undefined ? "" : v;
}

function makeLoaderCacheKey(
  cdnUrl: string,
  options: ToncastWidgetLoaderOptions,
): string {
  const integrity = options.integrity ?? "";
  const crossOrigin = normalizeCrossOrigin(options.crossOrigin);
  const nonce = options.nonce ?? "";
  // `timeoutMs` is intentionally NOT part of the cache key — it controls a
  // single load attempt, not the identity of the loaded constructor.
  return `${cdnUrl}\n${integrity}\n${crossOrigin}\n${nonce}`;
}

function effectiveScriptKey(el: HTMLScriptElement, src: string): string {
  if (el.hasAttribute(LOADER_KEY_ATTR)) {
    return el.getAttribute(LOADER_KEY_ATTR) ?? "";
  }
  return makeLoaderCacheKey(src, {});
}

function removeConflictingLoaderScripts(src: string, cacheKey: string): void {
  for (const el of Array.from(document.scripts)) {
    if (el.getAttribute("data-tc-widget-loader") !== src) continue;
    if (effectiveScriptKey(el, src) !== cacheKey) el.remove();
  }
}

/**
 * Tags injected before `data-tc-widget-loader-key` existed were treated as the
 * default-empty-options key via {@link effectiveScriptKey}. Stamp an explicit
 * key when the current load uses that default key so later loads with SRI/nonce
 * reliably remove this tag instead of colliding ambiguously.
 */
function stampLegacyLoaderScriptKeys(src: string, cacheKey: string): void {
  const defaultKey = makeLoaderCacheKey(src, {});
  if (cacheKey !== defaultKey) return;
  for (const el of Array.from(document.scripts)) {
    if (el.getAttribute("data-tc-widget-loader") !== src) continue;
    if (!el.hasAttribute(LOADER_KEY_ATTR)) {
      el.setAttribute(LOADER_KEY_ATTR, defaultKey);
    }
  }
}

function findLoaderScript(
  src: string,
  cacheKey: string,
): HTMLScriptElement | null {
  for (const el of Array.from(document.scripts)) {
    if (el.getAttribute("data-tc-widget-loader") !== src) continue;
    if (effectiveScriptKey(el, src) === cacheKey) return el;
  }
  return null;
}

/**
 * Download and cache the Toncast widget bundle from CDN.
 *
 * Cache key includes `cdnUrl`, `integrity`, `crossOrigin`, and `nonce`. Changing SRI or CSP nonce
 * therefore yields a separate cached constructor and replaces any older `<script>` tag for the same URL.
 * Legacy tags created before `data-tc-widget-loader-key` existed are treated as the default-empty-options key.
 * Each `load()` call with the default cache key re-stamps those tags with an explicit key so later loads
 * with SRI/nonce can remove them deterministically.
 *
 * Loads are serialized so `window.ToncastWidget` reads match the script that just finished when mixing URLs/options on one page.
 */
const ctorCache = new Map<string, ToncastWidgetConstructor>();
/** In-flight promise per cache key — dedupes concurrent `load(url, opts)` calls. */
const inflightByKey = new Map<string, Promise<ToncastWidgetConstructor>>();
/** Serializes script injection across different `cdnUrl`s without deferring the first `injectScript` (matches prior sync-until-await behavior). */
let serializeLocked = false;
const serializeWaiters: Array<() => void> = [];

/** Returns a promise only when another URL load is in progress; otherwise acquires the lock synchronously. */
function enterSerialization(): Promise<void> | undefined {
  if (!serializeLocked) {
    serializeLocked = true;
    return undefined;
  }
  return new Promise<void>((resolve) => {
    serializeWaiters.push(resolve);
  });
}

function leaveSerialization(): void {
  const next = serializeWaiters.shift();
  if (next) next();
  else serializeLocked = false;
}

async function loadUncached(
  cdnUrl: string,
  options: ToncastWidgetLoaderOptions,
  cacheKey: string,
): Promise<ToncastWidgetConstructor> {
  const hit = ctorCache.get(cacheKey);
  if (hit) return hit;

  await injectScript(cdnUrl, options, cacheKey);

  // The IIFE sets window.ToncastWidget = { ToncastWidget: [class] }
  // biome-ignore lint/suspicious/noExplicitAny: global set by CDN bundle
  const g = globalThis as any;
  const ctor: ToncastWidgetConstructor =
    g.ToncastWidget?.ToncastWidget ?? g.ToncastWidget;

  if (typeof ctor !== "function") {
    // Drop the script so a retry does not short-circuit on findLoaderScript().
    for (const el of Array.from(document.scripts)) {
      if (el.getAttribute("data-tc-widget-loader") === cdnUrl) el.remove();
    }
    throw new Error(
      "[ToncastWidgetLoader] CDN bundle loaded but window.ToncastWidget is not a constructor. " +
        "Check the CDN URL or bundle version.",
    );
  }

  ctorCache.set(cacheKey, ctor);
  return ctor;
}

async function load(
  cdnUrl: string = CDN_URL,
  options: ToncastWidgetLoaderOptions = {},
): Promise<ToncastWidgetConstructor> {
  if (typeof document === "undefined") {
    throw new Error(
      "[ToncastWidgetLoader] load() requires a browser environment (document is undefined). " +
        "Call it from client-side code only — gate behind useEffect / a `typeof window !== 'undefined'` check in SSR frameworks.",
    );
  }
  const cacheKey = makeLoaderCacheKey(cdnUrl, options);
  stampLegacyLoaderScriptKeys(cdnUrl, cacheKey);
  const cached = ctorCache.get(cacheKey);
  if (cached) return cached;

  let pending = inflightByKey.get(cacheKey);
  if (!pending) {
    const maybeWait = enterSerialization();
    pending = (async () => {
      if (maybeWait) await maybeWait;
      try {
        try {
          return await loadUncached(cdnUrl, options, cacheKey);
        } finally {
          leaveSerialization();
        }
      } finally {
        inflightByKey.delete(cacheKey);
      }
    })();
    inflightByKey.set(cacheKey, pending);
  }
  return pending;
}

function injectScript(
  src: string,
  options: ToncastWidgetLoaderOptions,
  cacheKey: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    removeConflictingLoaderScripts(src, cacheKey);
    if (findLoaderScript(src, cacheKey)) {
      resolve();
      return;
    }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      fn();
    };
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
    el.setAttribute(LOADER_KEY_ATTR, cacheKey);
    el.onload = () => finish(() => resolve());
    el.onerror = () => {
      el.remove();
      finish(() =>
        reject(
          new Error(`[ToncastWidgetLoader] Failed to load bundle from ${src}`),
        ),
      );
    };
    if (typeof options.timeoutMs === "number" && options.timeoutMs > 0) {
      const ms = options.timeoutMs;
      timer = setTimeout(() => {
        el.remove();
        finish(() =>
          reject(
            new Error(
              `[ToncastWidgetLoader] Timed out after ${ms}ms loading ${src}`,
            ),
          ),
        );
      }, ms);
    }
    document.head.appendChild(el);
  });
}

const ToncastWidgetLoader = { load, WIDGET_CDN_JS_URL };
export default ToncastWidgetLoader;
