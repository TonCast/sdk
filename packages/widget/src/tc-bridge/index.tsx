/**
 * TonConnect bridge: abstracts standalone vs integrated mode so widget
 * components stay agnostic. In standalone mode, wraps in TonConnectUIProvider
 * and reads from @tonconnect/ui-react hooks. In integrated mode, bridges an
 * externally-provided TonConnectUI instance into React state.
 */

import type { Theme, TonConnectUI } from "@tonconnect/ui-react";
import {
  TonConnectUIProvider,
  useIsConnectionRestored,
  useTonAddress,
  useTonConnectUI,
} from "@tonconnect/ui-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { tryTonConnectManifestUrl } from "./domain";
import { tonConnectThemeFromWidget } from "./tonconnectTheme";

interface TcState {
  address: string;
  restored: boolean;
  connect: () => void;
  disconnect: () => void;
  /** The raw TonConnectUI instance — needed for sendTransaction */
  instance: TonConnectUI | null;
}

const TcBridgeCtx = createContext<TcState | null>(null);

/** `false` only when standalone TonConnect manifest URL could not be built (invalid `domain`). Integrated mode leaves default `true`. */
const StandaloneManifestOkCtx = createContext(true);

export function useStandaloneManifestOk(): boolean {
  return useContext(StandaloneManifestOkCtx);
}

export function useTcState(): TcState {
  const ctx = useContext(TcBridgeCtx);
  if (!ctx) throw new Error("useTcState must be used within TcProvider");
  return ctx;
}

const brokenStandaloneNoop = () => {};
/** Stable context value when manifest URL is invalid — avoids re-rendering all `useTcState` consumers every parent tick. */
const BROKEN_STANDALONE_STATE: TcState = {
  address: "",
  restored: true,
  connect: brokenStandaloneNoop,
  disconnect: brokenStandaloneNoop,
  instance: null,
};

/** Keeps TonConnect UI theme in sync (TonConnectUI is a global singleton). */
function TonConnectThemeSync({ theme }: { theme: Theme }) {
  const [tc] = useTonConnectUI();
  useEffect(() => {
    tc.uiOptions = { uiPreferences: { theme } };
  }, [tc, theme]);
  return null;
}

// ─── Standalone provider: creates its own TonConnect inside widget tree ───

function StandaloneBridge({ children }: { children: ReactNode }) {
  const [tc] = useTonConnectUI();
  const address = useTonAddress();
  const restored = useIsConnectionRestored();

  const connect = useCallback(() => void tc.openModal(), [tc]);
  const disconnect = useCallback(() => void tc.disconnect(), [tc]);
  const state = useMemo<TcState>(
    () => ({
      address: address ?? "",
      restored,
      connect,
      disconnect,
      instance: tc,
    }),
    [address, restored, connect, disconnect, tc],
  );

  return <TcBridgeCtx.Provider value={state}>{children}</TcBridgeCtx.Provider>;
}

/** TonConnect unavailable — wallet UI is inert until the host fixes `domain`. */
function BrokenStandaloneBridge({ children }: { children: ReactNode }) {
  return <TcBridgeCtx.Provider value={BROKEN_STANDALONE_STATE}>{children}</TcBridgeCtx.Provider>;
}

export function StandaloneProvider({
  domain,
  widgetTheme,
  children,
}: {
  domain: string;
  /** Mirrors `config.widget.theme` — drives TonConnect modal appearance. */
  widgetTheme?: "light" | "dark" | "system";
  children: ReactNode;
}) {
  const manifestUrl = tryTonConnectManifestUrl(domain);
  const tonTheme = tonConnectThemeFromWidget(widgetTheme);
  if (!manifestUrl) {
    return (
      <StandaloneManifestOkCtx.Provider value={false}>
        <BrokenStandaloneBridge>{children}</BrokenStandaloneBridge>
      </StandaloneManifestOkCtx.Provider>
    );
  }
  return (
    <StandaloneManifestOkCtx.Provider value={true}>
      <TonConnectUIProvider
        manifestUrl={manifestUrl}
        analytics={{ mode: "off" }}
        uiPreferences={{ theme: tonTheme }}
      >
        <TonConnectThemeSync theme={tonTheme} />
        <StandaloneBridge>{children}</StandaloneBridge>
      </TonConnectUIProvider>
    </StandaloneManifestOkCtx.Provider>
  );
}

// ─── Integrated provider: bridges an existing TonConnectUI instance ───

export function IntegratedProvider({
  instance,
  widgetTheme,
  children,
}: {
  instance: TonConnectUI;
  widgetTheme?: "light" | "dark" | "system";
  children: ReactNode;
}) {
  const [address, setAddress] = useState(() => instance.account?.address ?? "");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    // Re-sync in case the wallet connected/restored between initial render and this effect.
    setAddress(instance.account?.address ?? "");
    const unsubscribe = instance.onStatusChange((wallet) => {
      setAddress(wallet?.account?.address ?? "");
    });
    // Mark as restored immediately — TonConnectUI restores from localStorage synchronously.
    setRestored(true);
    return unsubscribe;
  }, [instance]);

  useEffect(() => {
    instance.uiOptions = { uiPreferences: { theme: tonConnectThemeFromWidget(widgetTheme) } };
  }, [instance, widgetTheme]);

  const connect = useCallback(() => void instance.openModal(), [instance]);
  const disconnect = useCallback(() => void instance.disconnect(), [instance]);
  const state = useMemo<TcState>(
    () => ({
      address,
      restored,
      connect,
      disconnect,
      instance,
    }),
    [address, restored, connect, disconnect, instance],
  );

  return <TcBridgeCtx.Provider value={state}>{children}</TcBridgeCtx.Provider>;
}
