import {
  keepPreviousData,
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import type {
  BetQuote,
  QuoteFixedBetParams,
  QuoteLimitBetParams,
  QuoteMarketBetParams,
} from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { serializeKey } from "../utils/serializeKey";

export type UseBetQuoteParams =
  | ({ mode: "fixed" } & QuoteFixedBetParams)
  | ({ mode: "limit" } & QuoteLimitBetParams)
  | ({ mode: "market" } & QuoteMarketBetParams);

/**
 * Auto re-quotes when params change. Cheap to call on every slider tick:
 * TON bets are CPU-only, jetton bets reuse a cached `pricedCoins` snapshot
 * passed in via `params`.
 *
 * `placeholderData: keepPreviousData` prevents the UI from collapsing into
 * a loading skeleton each time the user nudges the slider — the previous
 * `BetQuote` stays visible while the next one is computed, so the modal
 * size doesn't jitter. The integrator can override with `options` if they
 * actually want a hard reload between params.
 *
 * Disabled when `params` is `null` (e.g. while waiting for `useBetSummary`
 * to resolve). The returned `BetQuote` keeps object identity inside
 * TanStack's cache, so `client.betting.confirmQuote(quote)` can recover
 * the original params via its internal WeakMap.
 */
export function useBetQuote(
  params: UseBetQuoteParams | null,
  options?: Omit<UseQueryOptions<BetQuote>, "queryKey" | "queryFn" | "enabled">,
): UseQueryResult<BetQuote> {
  const client = useToncastClient();
  return useQuery<BetQuote>({
    placeholderData: keepPreviousData,
    ...options,
    // BigInt fields (`maxBudgetTon`, `ticketsCount`, etc.) can't go through
    // TanStack's default JSON.stringify hasher — pre-serialise.
    queryKey: ["toncast", "betting", "quote", serializeKey(params)],
    queryFn: () => {
      if (!params) throw new Error("useBetQuote: params is null");
      switch (params.mode) {
        case "fixed":
          return client.betting.quoteFixedBet(params);
        case "limit":
          return client.betting.quoteLimitBet(params);
        case "market":
          return client.betting.quoteMarketBet(params);
      }
    },
    enabled: Boolean(params),
    // Quote computation is CPU-only for TON / cached for jettons; transient
    // failures here mean a real bug (validation, missing pricedCoins, RPC).
    // Surface them immediately rather than retrying silently for ~15 s while
    // the modal stays in skeleton state.
    retry: false,
    // The SDK keeps quote→params in an internal WeakMap so `confirmQuote`
    // can recover them automatically. TanStack's default `structuralSharing`
    // deep-clones data on every refetch, which breaks WeakMap identity →
    // `confirmQuote` then complains about missing params. Disabling it
    // hands the original quote object straight through.
    structuralSharing: false,
  });
}
