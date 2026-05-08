import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
// CSS is embedded as a text string by esbuild (loader: { '.css': 'text' })
// and injected into <head> on first mount.
import widgetCss from "./styles/widget.css";
import type { ToncastWidgetConfig, ToncastWidgetEventMap } from "./types";
import { Widget } from "./Widget";

const STYLE_ID = "toncast-widget-styles";
const STYLE_VERSION = "0.0.1";

/** Tracks how many ToncastWidget instances are currently mounted. */
let mountedCount = 0;

function injectStyles(): void {
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
  style.textContent = widgetCss as unknown as string;
  document.head.appendChild(style);
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

type EventListener<T> = T extends void ? () => void : (payload: T) => void;

export class ToncastWidget {
  private config: ToncastWidgetConfig;
  private root: Root | null = null;
  protected readonly listeners: Partial<{
    [K in keyof ToncastWidgetEventMap]: Array<EventListener<ToncastWidgetEventMap[K]>>;
  }> = {};

  constructor(config: ToncastWidgetConfig) {
    this.config = config;
  }

  /**
   * Merges current config with an `onBet` bridge.
   * Composes with user-supplied `onBet` if present — both receive every event.
   */
  private buildConfig(): ToncastWidgetConfig {
    const userOnBet = this.config.widget?.onBet;
    const onBet = (pariId: string, amount: bigint, side: "yes" | "no") => {
      this.emit("bet", { pariId, amount, side });
      userOnBet?.(pariId, amount, side);
    };
    return { ...this.config, widget: { ...this.config.widget, onBet } };
  }

  mount(container: Element): void {
    if (this.root) {
      console.warn("[ToncastWidget] already mounted — unmount first");
      return;
    }

    injectStyles();
    mountedCount++;
    this.root = createRoot(container);
    this.root.render(createElement(Widget, { config: this.buildConfig() }));
    this.emit("mount", { container } as ToncastWidgetEventMap["mount"]);
  }

  /**
   * Re-render the widget with an updated config without unmounting.
   * Changes to `endpoint`, `apiKey`, `network`, `language`, or `referral` will
   * create a fresh ToncastClient and reset the TanStack Query cache — a brief
   * loading state will appear. Purely visual changes (theme, cssVars, …) are
   * applied instantly without a data reload.
   *
   * Safe to call before `mount()` — the new config will be used on the next mount.
   */
  update(config: ToncastWidgetConfig): void {
    this.config = config;
    if (!this.root) return;
    this.root.render(createElement(Widget, { config: this.buildConfig() }));
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
