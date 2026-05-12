import { createContext, type ReactNode, useCallback, useContext, useMemo, useReducer } from "react";

import { NAV_INITIAL_STATE, navReducer, type WidgetView } from "./navReducer";
import type { ToncastWidgetConfig } from "./types";

export type { WidgetView };

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
  const [history, dispatch] = useReducer(navReducer, NAV_INITIAL_STATE);
  const view = history[history.length - 1] ?? { name: "list" };

  const navigate = useCallback((to: WidgetView) => {
    dispatch({ type: "navigate", view: to });
  }, []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const canGoBack = history.length > 1;

  // Stabilise context value to avoid spurious consumer re-renders when only
  // unrelated state changes upstream.
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
