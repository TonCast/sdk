import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import type { ToncastWidgetConfig } from "./types";

// ─── Navigation ───

export type WidgetView =
  | { name: "list" }
  | { name: "detail"; pariId: string; initialSide?: "yes" | "no" }
  | { name: "bets" };

interface NavContextValue {
  view: WidgetView;
  navigate: (to: WidgetView) => void;
  back: () => void;
  canGoBack: boolean;
}

const NavContext = createContext<NavContextValue | null>(null);

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<WidgetView[]>([{ name: "list" }]);
  const view = history[history.length - 1] ?? { name: "list" };

  const navigate = useCallback((to: WidgetView) => {
    setHistory((h) => [...h, to]);
  }, []);

  const back = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const canGoBack = history.length > 1;

  return <NavContext.Provider value={{ view, navigate, back, canGoBack }}>{children}</NavContext.Provider>;
}

// ─── Widget config context ───

const ConfigContext = createContext<ToncastWidgetConfig | null>(null);

export function useWidgetConfig(): ToncastWidgetConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useWidgetConfig must be used within ConfigProvider");
  return ctx;
}

/** Returns the onBet callback from widget config, or undefined if not set. */
export function useOnBet(): ((pariId: string, amount: bigint, side: "yes" | "no") => void) | undefined {
  return useWidgetConfig().widget?.onBet;
}

export function ConfigProvider({
  config,
  children,
}: {
  config: ToncastWidgetConfig;
  children: ReactNode;
}) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}
