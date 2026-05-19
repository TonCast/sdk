import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

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

export const ConfigContext = createContext<ToncastWidgetConfig | null>(null);

export function useWidgetConfig(): ToncastWidgetConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useWidgetConfig must be used within ConfigProvider");
  return ctx;
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

// ─── Bet emitter context ───
// Sole channel for surfacing successful bets to the host:
// `<Widget onBet={...} />` → BetEmitterProvider → useEmitBet() → BetCard.
// `ToncastWidget` wires its `bet` event listener through this same prop.

export type BetEmitterPayload = {
  pariId: string;
  amount: bigint;
  side: "yes" | "no";
};
export type BetEmitter = (payload: BetEmitterPayload) => void;

const BetEmitterContext = createContext<BetEmitter | null>(null);

/**
 * Provides a **stable** bet-emitter to descendants.
 *
 * Hosts often pass an inline arrow as `<Widget onBet={(p) => …}>` — naive
 * forwarding would change the context value on every render and force every
 * `useEmitBet()` consumer to re-render. We stash the latest callback in a ref
 * and expose a memoised wrapper whose identity only flips when the host
 * toggles between providing and not providing a callback.
 */
export function BetEmitterProvider({ emit, children }: { emit?: BetEmitter; children: ReactNode }) {
  const ref = useRef<BetEmitter | undefined>(emit);
  useEffect(() => {
    ref.current = emit;
  }, [emit]);
  const enabled = Boolean(emit);
  const stable = useMemo<BetEmitter | null>(
    () => (enabled ? (payload) => ref.current?.(payload) : null),
    [enabled],
  );
  return <BetEmitterContext.Provider value={stable}>{children}</BetEmitterContext.Provider>;
}

/** Returns the bet emitter when a host has subscribed via `<Widget onBet={…} />`. */
export function useEmitBet(): BetEmitter | null {
  return useContext(BetEmitterContext);
}
