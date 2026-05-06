import { keepPreviousData } from "@tanstack/react-query";
import type { BetSummary, PriceCoinsOptions } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";
import {
  type UseObservableQueryOptions,
  type UseObservableQueryResult,
  useObservableQuery,
} from "./useObservableQuery";

/**
 * `betting.subscribeSummary(pariId)` — pari + oddsState + priced coins for
 * the UI sliders. The hook subscribes to the SDK's two-phase summary stream:
 *
 *   1. **TON-only** snapshot — lands in ~200 ms (just pari + oddsState +
 *      wallet balance; no STON.fi swap routing). Lets the bet card render
 *      immediately with TON as a usable source coin.
 *   2. **Full** snapshot — same shape but `pricedCoins` now includes every
 *      viable jetton routed through STON.fi. Arrives once the markets cache
 *      is warm (cold: 3-8 s, warm: instant).
 *
 * `placeholderData: keepPreviousData` keeps the previous summary visible
 * across pari switches so the coin selector doesn't flash an empty skeleton.
 *
 * Disabled when `pariId` is falsy. Call `query.refetch()` after a confirmed
 * bet to reflect the new order book and balance.
 */
export function useBetSummary(
  pariId: string | null | undefined,
  opts: PriceCoinsOptions = {},
  options?: Omit<
    UseObservableQueryOptions<BetSummary>,
    "queryKey" | "requestFn" | "enabled"
  >,
): UseObservableQueryResult<BetSummary> {
  const client = useToncastClient();
  return useObservableQuery<BetSummary>({
    placeholderData: keepPreviousData,
    ...options,
    queryKey: toncastQueryKeys.betting.summary(pariId, opts),
    requestFn: () => client.betting.subscribeSummary(pariId as string, opts),
    enabled: Boolean(pariId),
  });
}
