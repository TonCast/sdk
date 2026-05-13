import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
// CSS is embedded as a text string by esbuild (loader: { '.css': 'text' })
// and injected into <head> on first mount.
import widgetCss from "./styles/widget.css";
import type { ToncastWidgetConfig, ToncastWidgetEventMap } from "./types";
import { Widget } from "./Widget";

const STYLE_ID = "toncast-widget-styles";

/** Present on `<link rel="stylesheet">` when layout CSS is supplied by the host ZIP/page. */
const CDN_STYLESHEET_ATTR = "data-toncast-widget-css";
const CDN_STYLESHEET_LOADED_ATTR = "data-toncast-widget-css-loaded";

/**
 * Derive a version tag from the CSS content so the injected <style> tag is
 * automatically replaced whenever widget.css changes — no manual bump needed.
 */
function cssHash(css: string): string {
  let h = 0;
  for (let i = 0; i < css.length; i++) {
    h = (Math.imul(31, h) + css.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
const STYLE_VERSION = cssHash(widgetCss);

/** Tracks how many ToncastWidget instances are currently mounted. */
let mountedCount = 0;

function injectStyles(): void {
  const cdnStylesheet = document.querySelector<HTMLLinkElement>(
    `link[rel="stylesheet"][${CDN_STYLESHEET_ATTR}]`,
  );
  if (
    cdnStylesheet &&
    (cdnStylesheet.getAttribute(CDN_STYLESHEET_LOADED_ATTR) === "true" || cdnStylesheet.sheet)
  ) {
    return;
  }
  const existing = document.getElementById(STYLE_ID);
  if (existing) {
    // Same version already injected — nothing to do.
    if (existing.getAttribute("data-version") === STYLE_VERSION) return;
    // Outdated version present — replace so the current CSS wins.
    existing.remove();
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.setAttribute("data-version", STYLE_VERSION);
  style.textContent = widgetCss;
  document.head.appendChild(style);
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

type EventListener<T> = T extends void ? () => void : (payload: T) => void;

/**
 * Imperative host for the betting UI. Use `mount` / `unmount` for DOM attachment;
 * use `dispose()` when discarding the instance to release all `on()` listeners.
 */
export class ToncastWidget {
  private config: ToncastWidgetConfig;
  private root: Root | null = null;
  protected readonly listeners: Partial<{
    [K in keyof ToncastWidgetEventMap]: Array<EventListener<ToncastWidgetEventMap[K]>>;
  }> = {};

  constructor(config: ToncastWidgetConfig) {
    this.config = config;
  }

  /** React element with the bet-event bridge wired into Widget's `onBet` prop. */
  private renderElement() {
    return createElement(Widget, {
      config: this.config,
      onBet: (payload) => this.emit("bet", payload),
    });
  }

  mount(container: Element): void {
    if (this.root) {
      console.warn("[ToncastWidget] already mounted — unmount first");
      return;
    }

    injectStyles();
    mountedCount++;
    this.root = createRoot(container);
    this.root.render(this.renderElement());
    this.emit("mount", { container } as ToncastWidgetEventMap["mount"]);
  }

  /**
   * Re-render the widget with an updated config without unmounting.
   * Changes to `baseUrl`, `wsUrl`, `endpoint`, `apiKey`, `network`, `language`, or `referral` will
   * create a fresh ToncastClient and reset the TanStack Query cache — a brief
   * loading state will appear. Purely visual changes (theme, cssVars, …) are
   * applied instantly without a data reload.
   *
   * Safe to call before `mount()` — the new config will be used on the next mount.
   */
  update(config: ToncastWidgetConfig): void {
    this.config = config;
    if (!this.root) return;
    this.root.render(this.renderElement());
  }

  unmount(): void {
    if (!this.root) return;
    this.root.unmount();
    this.root = null;
    mountedCount--;
    if (mountedCount <= 0) {
      mountedCount = 0;
      removeStyles();
    }
    this.emit("unmount", undefined);
  }

  /**
   * Unregisters all `on()` listeners and unmounts if still mounted.
   * Call when discarding the instance; do not use the instance after `dispose()`.
   * Listeners intentionally survive `unmount()` alone so `mount`/`unmount`/`mount`
   * cycles keep handlers — use `off()` for selective removal without dispose.
   */
  dispose(): void {
    if (this.root) this.unmount();
    for (const k of Object.keys(this.listeners) as Array<keyof ToncastWidgetEventMap>) {
      delete this.listeners[k];
    }
  }

  /**
   * Subscribe to lifecycle and bridge events from this host instance.
   *
   * - `mount` / `unmount` — widget attached to or removed from the DOM.
   * - `bet` — user placed a bet (sole subscription channel).
   * - `error` — emitted only when **another listener** you registered on this
   *   instance throws (for example your `bet` handler). Not all SDK/UI failures.
   */
  on<K extends keyof ToncastWidgetEventMap>(
    event: K,
    listener: EventListener<ToncastWidgetEventMap[K]>,
  ): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as Array<EventListener<ToncastWidgetEventMap[K]>>).push(listener);
    return this;
  }

  off<K extends keyof ToncastWidgetEventMap>(
    event: K,
    listener: EventListener<ToncastWidgetEventMap[K]>,
  ): this {
    if (!this.listeners[event]) return this;
    this.listeners[event] = (
      this.listeners[event] as Array<EventListener<ToncastWidgetEventMap[K]>>
    ).filter((l) => l !== listener) as (typeof this.listeners)[K];
    return this;
  }

  private emit<K extends keyof ToncastWidgetEventMap>(
    event: K,
    payload: ToncastWidgetEventMap[K],
  ): void {
    const handlers = this.listeners[event];
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: payload type varies per event
        (handler as (p: any) => void)(payload);
      } catch (err) {
        if (event === "error") {
          // Avoid infinite recursion: if an error handler itself throws, log it.
          console.error("[ToncastWidget] error handler threw:", err);
        } else {
          this.emit("error", err as ToncastWidgetEventMap["error"]);
        }
      }
    }
  }
}
