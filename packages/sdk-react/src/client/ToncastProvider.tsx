import { hashKey, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ToncastClient } from "@toncast/sdk";
import { type PropsWithChildren, useRef } from "react";
import { ToncastClientContext } from "./context";

/**
 * `JSON.stringify` doesn't serialize `BigInt`, but several SDK params include
 * one (`maxBudgetTon`, etc). Replace them with their decimal string in
 * queryKey hashing so React Query can dedupe correctly without throwing.
 */
function bigintSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function hashKeyBigintSafe(key: ReadonlyArray<unknown>): string {
  // `hashKey` from TanStack first sorts object keys deterministically, but
  // ultimately calls JSON.stringify — feed it a pre-sanitised structure.
  return hashKey(JSON.parse(JSON.stringify(key, bigintSafeReplacer)));
}

export interface ToncastProviderProps {
  /** Your `ToncastClient` instance — exposed to descendants via `useToncastClient()`. */
  client: ToncastClient;
  /**
   * Optional app-level TanStack `QueryClient`. When provided, the provider
   * uses **this client** for the inner `QueryClientProvider` so all SDK hooks
   * write into it. Pass the same instance you use elsewhere if you want one
   * unified cache; otherwise omit and the SDK spins up its own.
   *
   * The provider always renders a `QueryClientProvider` — relying on an
   * outer one is unsupported (the SDK's hooks would silently miss the
   * BigInt-safe `queryKeyHashFn`).
   */
  queryClient?: QueryClient;
}

/**
 * Top-level provider — wires the SDK client + a TanStack `QueryClient` (its
 * own or the one you pass in) into context. Every hook in this package reads
 * both of them.
 *
 * Pass your `client` once and forget about props drilling. The provider is
 * idempotent — call it again on app re-mount, no resource leaks.
 */
export function ToncastProvider({
  children,
  client,
  queryClient,
}: PropsWithChildren<ToncastProviderProps>) {
  const internalRef = useRef<QueryClient | null>(null);
  if (!queryClient && !internalRef.current) {
    internalRef.current = new QueryClient({
      defaultOptions: {
        queries: { queryKeyHashFn: hashKeyBigintSafe },
        mutations: {},
      },
    });
  }
  // Always wrap with QueryClientProvider — relying on a higher one in the
  // tree silently breaks BigInt-safe hashing for the SDK's queries.
  const effective = queryClient ?? (internalRef.current as QueryClient);
  return (
    <QueryClientProvider client={effective}>
      <ToncastClientContext.Provider value={client}>{children}</ToncastClientContext.Provider>
    </QueryClientProvider>
  );
}
