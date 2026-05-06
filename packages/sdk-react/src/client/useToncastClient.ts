import type { ToncastClient } from "@toncast/sdk";
import { useContext } from "react";
import { ToncastClientContext } from "./context";

/**
 * Get the `ToncastClient` from the nearest `<ToncastProvider>` ancestor.
 * Throws if used outside a provider — protects against silent no-ops.
 */
export function useToncastClient(): ToncastClient {
  const client = useContext(ToncastClientContext);
  if (!client) {
    throw new Error(
      "useToncastClient: no ToncastProvider in tree. Wrap your app in <ToncastProvider client={...}>.",
    );
  }
  return client;
}
