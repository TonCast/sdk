/**
 * TonConnect bridge: abstracts standalone vs integrated mode so widget
 * components stay agnostic. In standalone mode, wraps in TonConnectUIProvider
 * and reads from @tonconnect/ui-react hooks. In integrated mode, bridges an
 * externally-provided TonConnectUI instance into React state.
 */

import type { TonConnectUI } from "@tonconnect/ui-react";
import {
  TonConnectUIProvider,
  useIsConnectionRestored,
  useTonAddress,
  useTonConnectUI,
} from "@tonconnect/ui-react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

interface TcState {
  address: string;
  restored: boolean;
  connect: () => void;
  disconnect: () => void;
  /** The raw TonConnectUI instance — needed for sendTransaction */
  instance: TonConnectUI | null;
}

const TcBridgeCtx = createContext<TcState | null>(null);

export function useTcState(): TcState {
  const ctx = useContext(TcBridgeCtx);
  if (!ctx) throw new Error("useTcState must be used within TcProvider");
  return ctx;
}

// ─── Standalone provider: creates its own TonConnect inside widget tree ───

function StandaloneBridge({ children }: { children: ReactNode }) {
  const [tc] = useTonConnectUI();
  const address = useTonAddress();
  const restored = useIsConnectionRestored();

  const state: TcState = {
    address: address ?? "",
    restored,
    connect: () => void tc.openModal(),
    disconnect: () => void tc.disconnect(),
    instance: tc,
  };

  return <TcBridgeCtx.Provider value={state}>{children}</TcBridgeCtx.Provider>;
}

export function StandaloneProvider({ domain, children }: { domain: string; children: ReactNode }) {
  const manifestUrl = `${domain.replace(/\/$/, "")}/tonconnect-manifest.json`;
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl} analytics={{ mode: "off" }}>
      <StandaloneBridge>{children}</StandaloneBridge>
    </TonConnectUIProvider>
  );
}

// ─── Integrated provider: bridges an existing TonConnectUI instance ───

export function IntegratedProvider({
  instance,
  children,
}: {
  instance: TonConnectUI;
  children: ReactNode;
}) {
  const [address, setAddress] = useState(() => instance.account?.address ?? "");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    // Subscribe to wallet status changes via the public API
    const unsubscribe = instance.onStatusChange((wallet) => {
      setAddress(wallet?.account?.address ?? "");
    });
    // Mark as restored immediately — TonConnectUI restores from localStorage synchronously
    setRestored(true);
    return () => {
      unsubscribe();
    };
  }, [instance]);

  const state: TcState = {
    address,
    restored,
    connect: () => void instance.openModal(),
    disconnect: () => void instance.disconnect(),
    instance,
  };

  return <TcBridgeCtx.Provider value={state}>{children}</TcBridgeCtx.Provider>;
}
