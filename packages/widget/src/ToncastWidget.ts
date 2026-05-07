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
  if (document.getElementById(STYLE_ID)) return;
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
  private readonly config: ToncastWidgetConfig;
  private root: Root | null = null;
  protected readonly listeners: Partial<{
    [K in keyof ToncastWidgetEventMap]: Array<EventListener<ToncastWidgetEventMap[K]>>;
  }> = {};

  constructor(config: ToncastWidgetConfig) {
    this.config = config;
  }

  mount(container: Element): void {
    if (this.root) {
      console.warn("[ToncastWidget] already mounted — unmount first");
      return;
    }

    injectStyles();
    mountedCount++;
    this.root = createRoot(container);

    const onBet = (pariId: string, amount: bigint, side: "yes" | "no") => {
      this.emit("bet", { pariId, amount, side });
    };

    const configWithBet: ToncastWidgetConfig = {
      ...this.config,
      widget: { ...this.config.widget, onBet },
    };

    this.root.render(createElement(Widget, { config: configWithBet }));
    this.emit("mount", { container } as ToncastWidgetEventMap["mount"]);
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
