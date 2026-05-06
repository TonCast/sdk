import { keepPreviousData } from "@tanstack/react-query";
import type { PariStreamSnapshot, SubscribePariParams } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import {
  type UseObservableQueryOptions,
  type UseObservableQueryResult,
  useObservableQuery,
} from "./useObservableQuery";

/**
 * Live single-pari view: latest `PariStreamSnapshot` (`{ pari, oddsState,
 * coefficientHistory }`) re-emitted on every relevant change.
 *
 * Per-pari streams are pooled by `pariId + params` inside the SDK — re-mounts
 * (StrictMode, route revisits) reuse the warm stream. When `pariId` changes
 * we keep the previous snapshot on screen until the new one's initial fetch
 * settles.
 *
 * `BetEvent`s are not part of this snapshot — they're one-shot. Use the raw
 * stream object (`client.paris.subscribe(id).onBetEvent(...)`) if you need them.
 */
export function useSubscribe(
  pariId: string | null | undefined,
  params: SubscribePariParams = {},
  options?: Omit<
    UseObservableQueryOptions<PariStreamSnapshot>,
    "queryKey" | "requestFn" | "enabled"
  >,
): UseObservableQueryResult<PariStreamSnapshot> {
  const client = useToncastClient();
  return useObservableQuery<PariStreamSnapshot>({
    placeholderData: keepPreviousData,
    ...options,
    queryKey: ["toncast", "paris", "subscribe", pariId ?? "_disabled", params],
    requestFn: () => client.paris.subscribe(pariId as string, params),
    enabled: Boolean(pariId),
  });
}
