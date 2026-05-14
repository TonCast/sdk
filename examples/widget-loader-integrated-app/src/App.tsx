import type { ToncastWidgetEventMap } from "@toncast/widget-loader";
import { THEME, type Theme, TonConnectButton, TonConnectUIProvider } from "@tonconnect/ui-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { HostPanel } from "./components/HostPanel";
import { HostThemeSegment } from "./components/HostThemeSegment";
import {
  ToncastBettingWidget,
  type ToncastBettingWidgetHandle,
  type WidgetLoadPhase,
  type WidgetThemeChoice,
} from "./ToncastBettingWidget";
import { resolveTonconnectManifestUrl, viteEnvTrimmed } from "./viteEnv";

/** TonConnect modal chrome — aligned with `ToncastWidgetConfig.widget.theme`. */
function tonConnectUiTheme(theme: WidgetThemeChoice): Theme {
  switch (theme) {
    case "dark":
      return THEME.DARK;
    case "light":
      return THEME.LIGHT;
    default:
      return "SYSTEM";
  }
}

type BetFeedItem = ToncastWidgetEventMap["bet"] & { key: string; at: number };

type HostChromeProps = {
  widgetTheme: WidgetThemeChoice;
  onWidgetThemeChange: (t: WidgetThemeChoice) => void;
};

function HostChrome({ widgetTheme, onWidgetThemeChange }: HostChromeProps) {
  const [phase, setPhase] = useState<WidgetLoadPhase>("loading");
  const [bets, setBets] = useState<BetFeedItem[]>([]);
  const [embedKey, setEmbedKey] = useState(0);
  const widgetApiRef = useRef<ToncastBettingWidgetHandle | null>(null);
  const widgetTitleId = useId();
  const feedTitleId = useId();

  const cdnFromEnv = useMemo(() => viteEnvTrimmed("VITE_WIDGET_CDN_URL"), []);

  const onBet = useCallback((payload: ToncastWidgetEventMap["bet"]) => {
    setBets((prev) => {
      const row: BetFeedItem = {
        ...payload,
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        at: Date.now(),
      };
      return [row, ...prev].slice(0, 40);
    });
  }, []);

  const onWidgetError = useCallback((err: unknown) => {
    console.error("[HostChrome] widget listener error:", err);
  }, []);

  const onLifecycleUnmount = useCallback(() => {
    widgetApiRef.current?.unmount();
    console.info(
      "[HostChrome] demo: instance.unmount() — DOM only; listeners still attached. Prefer Remount before changing theme.",
    );
  }, []);

  const onLifecycleDispose = useCallback(() => {
    widgetApiRef.current?.dispose();
    console.info(
      "[HostChrome] demo: instance.dispose() — listeners cleared. Remount to load a new instance.",
    );
  }, []);

  const onLifecycleRemount = useCallback(() => {
    setEmbedKey((k) => k + 1);
    console.info(
      "[HostChrome] demo: React remount (key++) — effect cleanup will dispose any surviving instance.",
    );
  }, []);

  const onLifecycleDisposeAndRemount = useCallback(() => {
    widgetApiRef.current?.dispose();
    setEmbedKey((k) => k + 1);
    console.info("[HostChrome] demo: dispose() then remount — typical full teardown + fresh load.");
  }, []);

  const phasePill = (
    <span className="host-phase" data-phase={phase}>
      {phase === "loading" && "Loading bundle…"}
      {phase === "ready" && "Ready"}
      {phase === "error" && "Load error"}
    </span>
  );

  const widgetMetaFooter = (
    <>
      <div className="host-meta">
        <div>
          CDN script:{" "}
          <code>
            {cdnFromEnv ??
              "(default — set VITE_WIDGET_CDN_URL or pass cdnUrl prop to ToncastBettingWidget)"}
          </code>
        </div>
        <div className="host-meta-theme">
          The header theme drives TonConnect UI and the embed&apos;s <code>widget.theme</code>,{" "}
          <code>widget.ssrColorScheme</code>, and <code>widget.cssVars</code> (see{" "}
          <code>widgetEmbedChrome.ts</code>). <code>ToncastWidget.update()</code> applies changes
          without reloading the IIFE.
        </div>
      </div>
      <section className="host-lifecycle" aria-labelledby="host-lifecycle-demo-title">
        <h3 id="host-lifecycle-demo-title" className="host-lifecycle-label">
          Lifecycle demo
        </h3>
        <button type="button" className="host-lifecycle-btn" onClick={onLifecycleUnmount}>
          <code>unmount()</code>
        </button>
        <button type="button" className="host-lifecycle-btn" onClick={onLifecycleDispose}>
          <code>dispose()</code>
        </button>
        <button type="button" className="host-lifecycle-btn" onClick={onLifecycleRemount}>
          Remount (key++)
        </button>
        <button type="button" className="host-lifecycle-btn" onClick={onLifecycleDisposeAndRemount}>
          <code>dispose()</code> + remount
        </button>
        <p className="host-lifecycle-hint">
          Production: prefer <code>dispose()</code> when discarding the instance. React unmount of
          this component already calls <code>dispose()</code> in <code>useEffect</code> cleanup.
        </p>
      </section>
    </>
  );

  return (
    <div className="host-app" data-host-theme={widgetTheme}>
      <header className="host-header">
        <div className="host-brand">
          <strong className="host-brand-title">Host app · Toncast embed</strong>
          <span className="host-brand-sub">Option B — npm loader + integrated TonConnect</span>
        </div>
        <div className="host-header-actions">
          <HostThemeSegment value={widgetTheme} onChange={onWidgetThemeChange} />
          <div className="host-toolbar-wallet">
            <TonConnectButton />
          </div>
        </div>
      </header>

      <main className="host-main">
        <HostPanel
          title="Toncast widget"
          titleId={widgetTitleId}
          headerExtra={phasePill}
          footer={widgetMetaFooter}
        >
          <div className="host-panel-body">
            {phase === "loading" ? (
              <div className="host-loading" aria-busy="true" aria-live="polite">
                <div className="host-spinner" />
                <span>Fetching IIFE from CDN…</span>
              </div>
            ) : null}
            <div className="host-widget-surface">
              <ToncastBettingWidget
                key={embedKey}
                ref={widgetApiRef}
                widgetTheme={widgetTheme}
                onBet={onBet}
                onWidgetError={onWidgetError}
                onPhaseChange={setPhase}
              />
            </div>
          </div>
        </HostPanel>

        <HostPanel title="Host · widget events" titleId={feedTitleId} className="host-feed">
          <div className="host-feed-body">
            {bets.length === 0 ? (
              <p className="host-feed-empty">
                Successful bets from the widget appear here via{" "}
                <code>instance.on(&quot;bet&quot;, …)</code> bridged through <code>onBet</code>.
              </p>
            ) : (
              bets.map((b) => (
                <article key={b.key} className="host-bet-row">
                  <time dateTime={new Date(b.at).toISOString()}>
                    {new Date(b.at).toLocaleTimeString()}
                  </time>
                  <span className={`host-bet-side ${b.side}`}>{b.side.toUpperCase()}</span>
                  <span>
                    pari <code>{b.pariId}</code> · amount <code>{b.amount.toString()}</code>
                  </span>
                </article>
              ))
            )}
          </div>
        </HostPanel>
      </main>

      <p className="host-footnote">
        This page is a minimal host: your production app would own navigation, analytics, and layout
        around <code>ToncastBettingWidget</code>. Connect a wallet, then use the embedded UI as
        usual.
      </p>
    </div>
  );
}

export function App() {
  const [widgetTheme, setWidgetTheme] = useState<WidgetThemeChoice>("system");
  const tcTheme = useMemo(() => tonConnectUiTheme(widgetTheme), [widgetTheme]);
  const manifestUrl = useMemo(() => resolveTonconnectManifestUrl(), []);

  useEffect(() => {
    if (!manifestUrl.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(manifestUrl);
  }, [manifestUrl]);

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      analytics={{ mode: "off" }}
      uiPreferences={{ theme: tcTheme }}
    >
      <HostChrome widgetTheme={widgetTheme} onWidgetThemeChange={setWidgetTheme} />
    </TonConnectUIProvider>
  );
}
