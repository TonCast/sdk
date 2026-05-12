import {
  keepPreviousData,
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import type { MarketCapacity, OddsState } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";

export interface UseMarketCapacityOpts {
  /** Optional budget ceiling — clips `maxTickets` to whatever the budget can buy.
   * Use to drive a slider bounded by the user's wallet, not raw book depth. */
  maxBudgetTon?: bigint;
}

/**
 * `betting.marketCapacity(...)` — how many matched tickets are available for
 * a market bet on the given side, plus the per-yesOdds breakdown.
 *
 * Drives "1 step = 1 ticket" sliders: pass the result's `maxTickets` straight
 * into the slider's `max`, then call `useBetQuote({ mode: "market",
 * marketTickets: N, ... })` for each value.
 *
 * Either pass `pariId` (SDK fetches `oddsState` for you) or an existing
 * `OddsState` (no network call). Disabled when source is absent / falsy.
 */
export function useMarketCapacity(
  source: string | OddsState | null | undefined,
  isYes: boolean,
  opts: UseMarketCapacityOpts = {},
  options?: Omit<UseQueryOptions<MarketCapacity>, "queryKey" | "queryFn" | "enabled">,
): UseQueryResult<MarketCapacity> {
  const client = useToncastClient();
  const sourceKey = typeof source === "string" ? source : source ? "oddsState-inline" : "_disabled";
  return useQuery<MarketCapacity>({
    placeholderData: keepPreviousData,
    ...options,
    // The literal `oddsState` snapshot is intentionally NOT serialised into
    // the queryKey — it changes on every WS update and would invalidate the
    // cache on each broadcast. Callers passing an OddsState should re-mount
    // the hook (key on `pariId` upstream) when they need a fresh capacity.
    queryKey: toncastQueryKeys.betting.marketCapacity(sourceKey, isYes, opts),
    queryFn: () => client.betting.marketCapacity(source as string | OddsState, isYes, opts),
    enabled: source != null && source !== "",
  });
}
