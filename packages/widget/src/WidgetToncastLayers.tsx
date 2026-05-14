import { createTonClient, ToncastClient } from "@toncast/sdk";
import { ToncastProvider } from "@toncast/sdk-react";
import { useEffect, useRef, type ReactNode } from "react";
import { I18nProvider } from "./i18n/I18nProvider";
import type { ClientStandaloneDescriptor, ToncastWidgetConfig } from "./types";
import { useSyncClientFromConfig } from "./utils/useSyncClientFromConfig";

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
  children: ReactNode;
}) {
  // Single source of truth: construct the client without `language` / `referral`
  // and let `useSyncClientFromConfig` apply them via setLanguage / setReferral.
  // This avoids a duplicate apply on initial mount and keeps clearing semantics
  // (PR-24 L-1) routed through one code path.
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
    });
  }
  useSyncClientFromConfig(clientRef.current, widget, { ownsClient: true });

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
  children: ReactNode;
}) {
  useSyncClientFromConfig(client, widget, { ownsClient: false });
  return (
    <ToncastProvider client={client}>
      <I18nProvider>{children}</I18nProvider>
    </ToncastProvider>
  );
}

/** Wraps children with the correct ToncastProvider + I18n layer. */
export function ToncastLayer({
  config,
  children,
}: {
  config: ToncastWidgetConfig;
  children: ReactNode;
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
