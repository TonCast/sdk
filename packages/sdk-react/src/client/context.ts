import type { ToncastClient } from "@toncast/sdk";
import { createContext } from "react";

/**
 * React context that holds a single `ToncastClient` instance.
 * Wrap your app in `<ToncastProvider client={...}>` and consume via
 * `useToncastClient()` from any descendant.
 */
export const ToncastClientContext = createContext<ToncastClient | null>(null);
