import ToncastWidgetLoader, {
  type ToncastWidgetConfig,
  type ToncastWidgetEventMap,
  type ToncastWidgetInstance,
} from "@toncast/widget-loader";
import { useTonConnectUI } from "@tonconnect/ui-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { nonEmptyTrim, viteEnvTrimmed } from "./viteEnv";
import { buildHostWidgetOptions } from "./widgetEmbedChrome";

export type WidgetLoadPhase = "loading" | "ready" | "error";

/** Matches `ToncastWidgetConfig.widget.theme` — forwarded into `new Widget({ widget: { theme } })`. */
export type WidgetThemeChoice = NonNullable<NonNullable<ToncastWidgetConfig["widget"]>["theme"]>;

/** Imperative API for demos and rare host flows — maps to `ToncastWidgetInstance`. */
export type ToncastBettingWidgetHandle = {
  /** Removes the widget from the DOM only; `on()` listeners remain until `dispose()` or React unmount. */
  unmount: () => void;
  /** Unmounts if needed and clears all listeners; the instance must not be used after this. */
  dispose: () => void;
};

export type ToncastBettingWidgetProps = {
  /** When set, passed to `ToncastWidgetLoader.load(cdnUrl)`. Else `VITE_WIDGET_CDN_URL` (see `viteEnv.ts`), else package default CDN. */
  cdnUrl?: string;
  /** Visual theme for the embedded Toncast UI (`widget.theme`). */
  widgetTheme?: WidgetThemeChoice;
  /** Optional class on the mount target; host layout classes (e.g. flex fill) stay on a parent wrapper. */
  mountClassName?: string;
  /** Fired when the real widget emits `bet` (successful bet). */
  onBet?: (payload: ToncastWidgetEventMap["bet"]) => void;
  /** Fired when a user-registered widget listener throws (see `ToncastWidgetEventMap["error"]`). */
  onWidgetError?: (err: unknown) => void;
  /** Lets the host show chrome (status pill, skeleton) around the embed. */
  onPhaseChange?: (phase: WidgetLoadPhase) => void;
};

function resolveCdnUrl(prop?: string): string | undefined {
  return nonEmptyTrim(prop) ?? viteEnvTrimmed("VITE_WIDGET_CDN_URL");
}

/** `prefers-color-scheme` snapshot for `widget.ssrColorScheme` when theme is `system`. */
function useSystemColorScheme(): "light" | "dark" {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    () => "light",
  );
}

/** Integrated TonConnect + full host `widget` styling slice from {@link buildHostWidgetOptions}. */
function buildWidgetConfig(
  tonconnect: ReturnType<typeof useTonConnectUI>[0],
  theme: WidgetThemeChoice,
  systemColorScheme: "light" | "dark",
): ToncastWidgetConfig {
  return {
    tonconnect: { type: "integrated", instance: tonconnect },
    widget: buildHostWidgetOptions(theme, systemColorScheme),
  };
}

export const ToncastBettingWidget = forwardRef<
  ToncastBettingWidgetHandle,
  ToncastBettingWidgetProps
>(function ToncastBettingWidget(
  { cdnUrl, widgetTheme = "system", mountClassName, onBet, onWidgetError, onPhaseChange },
  ref,
) {
  const [tonconnect] = useTonConnectUI();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<ToncastWidgetInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onBetRef = useRef(onBet);
  const onPhaseRef = useRef(onPhaseChange);
  const onWidgetErrorRef = useRef(onWidgetError);
  const widgetThemeRef = useRef(widgetTheme);
  const systemScheme = useSystemColorScheme();
  const systemSchemeRef = useRef(systemScheme);
  systemSchemeRef.current = systemScheme;
  onBetRef.current = onBet;
  onPhaseRef.current = onPhaseChange;
  onWidgetErrorRef.current = onWidgetError;
  widgetThemeRef.current = widgetTheme;

  useImperativeHandle(
    ref,
    () => ({
      unmount: () => {
        widgetRef.current?.unmount();
      },
      dispose: () => {
        widgetRef.current?.dispose();
        widgetRef.current = null;
      },
    }),
    [],
  );

  useEffect(() => {
    let active = true;
    const resolved = resolveCdnUrl(cdnUrl);
    setLoadError(null);
    onPhaseRef.current?.("loading");

    const betBridge = (payload: ToncastWidgetEventMap["bet"]) => {
      onBetRef.current?.(payload);
    };

    const errorBridge = (err: unknown) => {
      console.error("[ToncastBettingWidget] widget `error` event (listener threw):", err);
      onWidgetErrorRef.current?.(err);
    };

    const loadPromise =
      resolved !== undefined ? ToncastWidgetLoader.load(resolved) : ToncastWidgetLoader.load();

    loadPromise
      .then((Widget) => {
        if (!active || !containerRef.current) return;
        const instance = new Widget(
          buildWidgetConfig(tonconnect, widgetThemeRef.current, systemSchemeRef.current),
        );
        widgetRef.current = instance;
        instance.on("bet", betBridge);
        instance.on("error", errorBridge);
        instance.mount(containerRef.current);
        onPhaseRef.current?.("ready");
      })
      .catch((err: unknown) => {
        console.error("[ToncastBettingWidget] load failed:", err);
        if (!active) return;
        onPhaseRef.current?.("error");
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
      });

    return () => {
      active = false;
      widgetRef.current?.dispose();
      widgetRef.current = null;
    };
  }, [tonconnect, cdnUrl]);

  /** Theme / TonConnect instance changes update the mounted widget without reloading the IIFE. */
  useEffect(() => {
    const w = widgetRef.current;
    if (!w) return;
    w.update(buildWidgetConfig(tonconnect, widgetTheme, systemScheme));
  }, [tonconnect, widgetTheme, systemScheme]);

  return (
    <>
      {loadError ? <div role="alert">Widget failed to load: {loadError}</div> : null}
      <div
        ref={containerRef}
        data-testid="toncast-widget-root"
        className={mountClassName?.trim() ? mountClassName.trim() : undefined}
      />
    </>
  );
});

ToncastBettingWidget.displayName = "ToncastBettingWidget";
