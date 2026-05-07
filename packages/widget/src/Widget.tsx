import { createTonClient, ToncastClient } from "@toncast/sdk";
import { ToncastProvider } from "@toncast/sdk-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { NavBar } from "./components/NavBar";
import { WidgetHeader } from "./components/WidgetHeader";
import { ConfigProvider, NavProvider, useNav } from "./context";
import { I18nProvider } from "./i18n/I18nProvider";
import { IntegratedProvider, StandaloneProvider } from "./tc-bridge";
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

// Internal router — renders the active view
function WidgetShell() {
  const { view } = useNav();

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

// Wraps with ToncastProvider + I18n
function ToncastLayer({
  config,
  children,
}: {
  config: ToncastWidgetConfig;
  children: React.ReactNode;
}) {
  const clientRef = useRef<ToncastClient | null>(null);

  let client: ToncastClient;
  if (config.client?.type === "integrated") {
    client = config.client.instance;
  } else {
    if (!clientRef.current) {
      clientRef.current = new ToncastClient({
        tonClient: createTonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" }),
        referral: config.widget?.referral,
        language: config.widget?.language,
      });
    }
    client = clientRef.current;
  }

  return (
    <ToncastProvider client={client}>
      <I18nProvider>{children}</I18nProvider>
    </ToncastProvider>
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
            <WidgetShell />
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
