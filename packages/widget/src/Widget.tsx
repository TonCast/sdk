import { useQueryClient } from "@tanstack/react-query";
import { createTonClient, ToncastClient } from "@toncast/sdk";
import { ToncastProvider, useTonConnectClient } from "@toncast/sdk-react";
import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { NavBar } from "./components/NavBar";
import { WidgetHeader } from "./components/WidgetHeader";
import {
  BetEmitterProvider,
  ConfigProvider,
  NavProvider,
  useNav,
  useWidgetConfig,
} from "./context";
import { I18nProvider } from "./i18n/I18nProvider";
import { useT } from "./i18n/useT";
import {
  IntegratedProvider,
  StandaloneProvider,
  useStandaloneManifestOk,
  useTcState,
} from "./tc-bridge";
import { buildCssVarStyle } from "./theme/cssVars";
import type { ClientStandaloneDescriptor, ToncastWidgetConfig } from "./types";
import { cn } from "./utils/cn";
import { stableJsonStringify } from "./utils/stableJsonStringify";
import { usePrefersColorSchemeDark } from "./utils/usePrefersColorSchemeDark";
import { useSyncClientFromConfig } from "./utils/useSyncClientFromConfig";
import { MyBetsView } from "./views/MyBets";
import { PariDetailView } from "./views/PariDetail";
import { ParisListView } from "./views/ParisList";

/**
 * Catches render errors and shows an inline retry card.
 * Text props allow the parent functional wrapper to inject translated strings
 * since class components cannot call hooks directly.
 */
class ErrorBoundary extends Component<
  {
    children: ReactNode;
    errorText: string;
    retryText: string;
    onRenderError?: (error: Error, info: ErrorInfo) => void;
  },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ToncastWidget] Uncaught render error:", error, info.componentStack);
    this.props.onRenderError?.(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="tc-error tc-error-card">
          <p className="tc-error-card-msg">{this.props.errorText}</p>
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
  const config = useWidgetConfig();
  return (
    <ErrorBoundary
      errorText={t("error.somethingWentWrong")}
      retryText={t("error.retry")}
      onRenderError={config.widget?.onRenderError}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Inline alert when standalone `tonconnect.options.domain` is missing or not an absolute http(s) URL. */
function StandaloneDomainWarning() {
  const t = useT();
  return (
    <div role="alert" className="tc-standalone-domain-warning">
      {t("error.invalidStandaloneDomain")}
    </div>
  );
}

/** Internal router — syncs wallet state and renders the active view. */
function WidgetShell() {
  const { view } = useNav();
  const { address } = useTcState();
  const standaloneManifestOk = useStandaloneManifestOk();
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
      {!standaloneManifestOk && <StandaloneDomainWarning />}
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
 *
 * Rendered with a `key` by ToncastLayer — React remounts it (and resets the
 * TanStack-Query cache) only when **data-source identity** changes:
 * `baseUrl`, `wsUrl`, `endpoint`, `apiKey`, or `network`. Soft config bits
 * such as `widget.language` / `widget.referral` are **not** part of the key
 * — they are pushed into the live client via `useSyncClientFromConfig`, so
 * a language/referral switch keeps the WS subscriptions and Query cache
 * alive.
 */
function StandaloneClientLayer({
  desc,
  widget,
  children,
}: {
  desc: ClientStandaloneDescriptor | undefined;
  widget: ToncastWidgetConfig["widget"];
  children: React.ReactNode;
}) {
  const clientRef = useRef<ToncastClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new ToncastClient({
      baseUrl: desc?.baseUrl,
      wsUrl: desc?.wsUrl,
      tonClient: createTonClient({
        endpoint: desc?.endpoint,
        apiKey: desc?.apiKey,
        network: desc?.network,
      }),
      referral: widget?.referral,
      language: widget?.language,
    });
  }
  useSyncClientFromConfig(clientRef.current, widget);

  // Clean up when this layer unmounts (key change = new client-critical config).
  useEffect(() => {
    return () => {
      clientRef.current?.clearUserAddress();
      clientRef.current?.dispose();
    };
  }, []);

  return (
    <ToncastProvider client={clientRef.current}>
      <I18nProvider>{children}</I18nProvider>
    </ToncastProvider>
  );
}

/**
 * Integrated counterpart of `StandaloneClientLayer` — wraps the host-provided
 * `ToncastClient` and pushes `widget.language` / `widget.referral` into it
 * via `useSyncClientFromConfig`. Without this hook the host's client would
 * silently ignore those config fields (M-2).
 */
function IntegratedClientLayer({
  client,
  widget,
  children,
}: {
  client: ToncastClient;
  widget: ToncastWidgetConfig["widget"];
  children: React.ReactNode;
}) {
  useSyncClientFromConfig(client, widget);
  return (
    <ToncastProvider client={client}>
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
      <IntegratedClientLayer client={config.client.instance} widget={config.widget}>
        {children}
      </IntegratedClientLayer>
    );
  }

  // Standalone: key the layer by data-source identity only. Language/referral
  // are pushed in via setLanguage/setReferral so a language switch does not
  // remount the client (preserves WS subs + query cache).
  const desc = config.client as ClientStandaloneDescriptor | undefined;
  const clientKey = [
    desc?.baseUrl ?? "",
    desc?.wsUrl ?? "",
    desc?.endpoint ?? "",
    desc?.apiKey ?? "",
    desc?.network ?? "mainnet",
  ].join("|");

  return (
    <StandaloneClientLayer key={clientKey} desc={desc} widget={config.widget}>
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
  /**
   * Called when the user successfully sends a bet transaction. Mirror of the
   * `bet` event on the imperative `ToncastWidget` class — pick whichever entry
   * point matches your integration.
   */
  onBet?: (payload: { pariId: string; amount: bigint; side: "yes" | "no" }) => void;
  /**
   * Called when the widget `ErrorBoundary` catches a render error. Overrides
   * `config.widget.onRenderError` when both are set.
   */
  onRenderError?: (error: Error, info: ErrorInfo) => void;
}

export function Widget({ config, className, style, onBet, onRenderError }: WidgetProps) {
  const configTheme = config.widget?.theme;
  const prefersDark = usePrefersColorSchemeDark({
    enabled: configTheme === "system",
    serverSnapshot: config.widget?.ssrColorScheme === "dark",
  });
  const effectiveTheme: "light" | "dark" =
    configTheme === "system" ? (prefersDark ? "dark" : "light") : (configTheme ?? "light");

  const themeClass = effectiveTheme === "dark" ? "tc-w tc-dark" : "tc-w";
  const cssVarsInput = config.widget?.cssVars;
  const layoutInput = config.widget?.layout;
  const deriveCssVarsInput = config.widget?.deriveCssVars;
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps use stableJsonStringify(...) so inline cssVars object identity does not force rebuild every render; see utils/stableJsonStringify.ts
  const cssVarStyle = useMemo(
    () => buildCssVarStyle(cssVarsInput, effectiveTheme, deriveCssVarsInput, layoutInput),
    [
      stableJsonStringify(cssVarsInput),
      effectiveTheme,
      stableJsonStringify(deriveCssVarsInput),
      stableJsonStringify(layoutInput),
    ],
  );

  // Inject effectiveTheme into config so child components (e.g. WidgetHeader) can read it.
  // `config` identity may change every parent render if the host passes an inline object —
  // we only stabilize against our own `effectiveTheme` flip without deep-equality on `config`.
  const configWithTheme = useMemo<ToncastWidgetConfig>(
    () => ({
      ...config,
      widget: {
        ...config.widget,
        theme: effectiveTheme,
        onRenderError: onRenderError ?? config.widget?.onRenderError,
      },
    }),
    [config, effectiveTheme, onRenderError],
  );

  const inner = (
    <ToncastLayer config={config}>
      <ConfigProvider config={configWithTheme}>
        <BetEmitterProvider emit={onBet}>
          <NavProvider>
            <div
              className={cn(themeClass, className)}
              style={cssVarStyle || style ? { ...cssVarStyle, ...style } : undefined}
              suppressHydrationWarning={configTheme === "system"}
            >
              <WidgetErrorBoundary>
                <WidgetShell />
              </WidgetErrorBoundary>
            </div>
          </NavProvider>
        </BetEmitterProvider>
      </ConfigProvider>
    </ToncastLayer>
  );

  if (config.tonconnect.type === "integrated") {
    return (
      <IntegratedProvider instance={config.tonconnect.instance} widgetTheme={config.widget?.theme}>
        {inner}
      </IntegratedProvider>
    );
  }

  return (
    <StandaloneProvider
      domain={config.tonconnect.options.domain}
      widgetTheme={config.widget?.theme}
    >
      {inner}
    </StandaloneProvider>
  );
}
