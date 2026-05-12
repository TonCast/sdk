import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import type { ToncastWidgetConfig } from "./types";

const NAV_MAX_DEPTH = 20;
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
    setHistory((h) => {
      const current = h[h.length - 1];
      if (!current) return [...h, to];
      // Skip duplicate for tab-level views (list, bets).
      if (current.name === to.name && !("pariId" in to)) return h;
      // Skip duplicate for detail view with same pariId AND same initialSide.
      // If initialSide differs (e.g. YES→NO pre-selection), allow the push so
      // the detail view can update its default bet side.
      if (
        current.name === "detail" &&
        to.name === "detail" &&
        current.pariId === to.pariId &&
        current.initialSide === to.initialSide
      )
        return h;
      // Keep at most NAV_MAX_DEPTH entries to prevent unbounded memory growth.
      return [...h, to].slice(-NAV_MAX_DEPTH);
    });
  }, []);

  const back = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const canGoBack = history.length > 1;

  // Stabilize the context object so consumers don't re-render on unrelated
  // NavProvider renders. navigate and back are already stable (useCallback).
  const value = useMemo(
    () => ({ view, navigate, back, canGoBack }),
    [view, navigate, back, canGoBack],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

// ─── Widget config context ───

const ConfigContext = createContext<ToncastWidgetConfig | null>(null);

export function useWidgetConfig(): ToncastWidgetConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useWidgetConfig must be used within ConfigProvider");
  return ctx;
}

/** Returns the onBet callback from widget config, or undefined if not set. */
export function useOnBet():
  | ((pariId: string, amount: bigint, side: "yes" | "no") => void)
  | undefined {
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
