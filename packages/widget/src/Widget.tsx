import { createTonClient, ToncastClient } from "@toncast/sdk";
import { ToncastProvider, useTonConnectClient } from "@toncast/sdk-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ClientStandaloneDescriptor } from "./types";
import { NavBar } from "./components/NavBar";
import { WidgetHeader } from "./components/WidgetHeader";
import { ConfigProvider, NavProvider, useNav } from "./context";
import { I18nProvider } from "./i18n/I18nProvider";
import { useT } from "./i18n/useT";
import { IntegratedProvider, StandaloneProvider, useTcState } from "./tc-bridge";
import type { ToncastWidgetConfig, ToncastWidgetCssVars, ToncastWidgetCssVarsBase } from "./types";
import { cn } from "./utils/cn";
import { MyBetsView } from "./views/MyBets";
import { PariDetailView } from "./views/PariDetail";
import { ParisListView } from "./views/ParisList";

/** Subscribes to OS color scheme preference and returns the effective theme. */
function useSystemTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return theme;
}

/** Converts a cssVarsBase object to inline CSS custom properties record. */
function applyVarsBase(vars: ToncastWidgetCssVarsBase, style: Record<string, string>): void {
  if (vars.accent) {
    style["--tc-accent"] = vars.accent;
    // Mirror hover to accent unless separately overridden.
    if (!style["--tc-accent-hover"]) style["--tc-accent-hover"] = vars.accent;
  }
  if (vars.accentHover) style["--tc-accent-hover"] = vars.accentHover;
  if (vars.bg) style["--tc-bg"] = vars.bg;
  if (vars.bgCard) style["--tc-bg-card"] = vars.bgCard;
  if (vars.bgMuted) style["--tc-bg-muted"] = vars.bgMuted;
  if (vars.fg) style["--tc-fg"] = vars.fg;
  if (vars.fgMuted) style["--tc-fg-muted"] = vars.fgMuted;
  if (vars.border) style["--tc-border"] = vars.border;
  if (vars.radius) style["--tc-radius"] = vars.radius;
  if (vars.gridCols) style["--tc-grid-cols"] = vars.gridCols;
}

/**
 * Builds inline CSS custom properties from cssVars config.
 * Theme-specific sub-objects (light/dark) take precedence over base vars.
 */
function buildCssVarStyle(
  vars: ToncastWidgetCssVars | undefined,
  effectiveTheme: "light" | "dark",
): CSSProperties | undefined {
  if (!vars) return undefined;
  const style: Record<string, string> = {};

  // Apply base vars first, then override with theme-specific ones.
  applyVarsBase(vars, style);
  const themeOverrides = effectiveTheme === "dark" ? vars.dark : vars.light;
  if (themeOverrides) applyVarsBase(themeOverrides, style);

  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}

/**
 * Catches render errors and shows an inline retry card.
 * Text props allow the parent functional wrapper to inject translated strings
 * since class components cannot call hooks directly.
 */
class ErrorBoundary extends Component<
  { children: ReactNode; errorText: string; retryText: string },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ToncastWidget] Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="tc-error" style={{ padding: 16, textAlign: "center" }}>
          <p style={{ marginBottom: 10 }}>{this.props.errorText}</p>
          <button
            type="button"
            className="tc-btn tc-btn-secondary"
            onClick={() => this.setState({ error: null })}
          >
            {this.props.retryText}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Functional wrapper that supplies translated strings to the class ErrorBoundary. */
function WidgetErrorBoundary({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <ErrorBoundary errorText={t("error.somethingWentWrong")} retryText={t("error.retry")}>
      {children}
    </ErrorBoundary>
  );
}

/** Internal router — syncs wallet state and renders the active view. */
function WidgetShell() {
  const { view } = useNav();
  const { address } = useTcState();
  const queryClient = useQueryClient();

  // delegate address→client sync to the canonical SDK hook (avoids duplication).
  useTonConnectClient(address || null);

  // Flush only user-scoped caches when the wallet changes. Public data
  // (paris list, categories, pari details) is wallet-agnostic and should
  // NOT be invalidated — doing so causes a visible blank-then-refetch cycle.
  const prevAddrRef = useRef(address);
  useEffect(() => {
    if (prevAddrRef.current === address) return;
    prevAddrRef.current = address;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["toncast", "betting"] }),
      queryClient.invalidateQueries({ queryKey: ["toncast", "coins"] }),
    ]);
  }, [address, queryClient]);

  return (
    <div className="tc-shell">
      <WidgetHeader />
      <div className="tc-content">
        {view.name === "list" && <ParisListView />}
        {view.name === "detail" && <PariDetailView view={view} />}
        {view.name === "bets" && <MyBetsView />}
      </div>
      <NavBar />
    </div>
  );
}

/**
 * Isolated component that holds a single standalone ToncastClient.
 * Rendered with a `key` by ToncastLayer — React remounts it (and resets TanStack
 * Query cache) whenever client-critical config changes: endpoint, apiKey, network,
 * language, or referral. All other config changes (theme, cssVars, …) don't affect
 * the key, so the client survives cosmetic re-renders.
 */
function StandaloneClientLayer({
  desc,
  config,
  children,
}: {
  desc: ClientStandaloneDescriptor | undefined;
  config: ToncastWidgetConfig;
  children: React.ReactNode;
}) {
  const clientRef = useRef<ToncastClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new ToncastClient({
      tonClient: createTonClient({
        endpoint: desc?.endpoint,
        apiKey: desc?.apiKey,
        network: desc?.network,
      }),
      referral: config.widget?.referral,
      language: config.widget?.language,
    });
  }

  // Clean up when this layer unmounts (key change = new client-critical config).
  // ToncastClient has no dispose() today, but clearing userAddress prevents the
  // old instance from being called back into if a ref escapes. When dispose() is
  // added to the SDK, replace this with clientRef.current.dispose().
  useEffect(() => {
    return () => {
      clientRef.current?.clearUserAddress();
      (clientRef.current as unknown as { dispose?: () => void })?.dispose?.();
    };
  }, []);

  return (
    <ToncastProvider client={clientRef.current}>
      <I18nProvider>{children}</I18nProvider>
    </ToncastProvider>
  );
}

/** Wraps children with the correct ToncastProvider + I18n layer. */
function ToncastLayer({
  config,
  children,
}: {
  config: ToncastWidgetConfig;
  children: React.ReactNode;
}) {
  // Integrated: host controls the client — always use the latest instance.
  if (config.client?.type === "integrated") {
    return (
      <ToncastProvider client={config.client.instance}>
        <I18nProvider>{children}</I18nProvider>
      </ToncastProvider>
    );
  }

  // Standalone: build a stable key from client-critical config. When any of
  // these change the StandaloneClientLayer remounts, creating a fresh client
  // and resetting TanStack Query cache (correct — the data source changed).
  const desc = config.client as ClientStandaloneDescriptor | undefined;
  const clientKey = [
    desc?.endpoint ?? "",
    desc?.apiKey ?? "",
    desc?.network ?? "mainnet",
    config.widget?.language ?? "",
    config.widget?.referral?.address ?? "",
    String(config.widget?.referral?.pct ?? ""),
  ].join("|");

  return (
    <StandaloneClientLayer key={clientKey} desc={desc} config={config}>
      {children}
    </StandaloneClientLayer>
  );
}

export interface WidgetProps {
  config: ToncastWidgetConfig;
  /** Extra class names applied to the widget root element. */
  className?: string;
  /** Inline styles merged onto the widget root element (after cssVars). */
  style?: CSSProperties;
}

export function Widget({ config, className, style }: WidgetProps) {
  const systemTheme = useSystemTheme();
  const configTheme = config.widget?.theme;
  const effectiveTheme: "light" | "dark" =
    configTheme === "system" ? systemTheme : (configTheme ?? "light");

  const themeClass = effectiveTheme === "dark" ? "tc-w tc-dark" : "tc-w";
  const cssVarStyle = buildCssVarStyle(config.widget?.cssVars, effectiveTheme);

  // Inject effectiveTheme into config so child components (e.g. WidgetHeader) can read it.
  const configWithTheme: ToncastWidgetConfig = {
    ...config,
    widget: { ...config.widget, theme: effectiveTheme },
  };

  const inner = (
    <ToncastLayer config={config}>
      <ConfigProvider config={configWithTheme}>
        <NavProvider>
          <div
            className={cn(themeClass, className)}
            style={cssVarStyle || style ? { ...cssVarStyle, ...style } : undefined}
          >
            <WidgetErrorBoundary>
              <WidgetShell />
            </WidgetErrorBoundary>
          </div>
        </NavProvider>
      </ConfigProvider>
    </ToncastLayer>
  );

  if (config.tonconnect.type === "integrated") {
    return <IntegratedProvider instance={config.tonconnect.instance}>{inner}</IntegratedProvider>;
  }

  return <StandaloneProvider domain={config.tonconnect.options.domain}>{inner}</StandaloneProvider>;
}
