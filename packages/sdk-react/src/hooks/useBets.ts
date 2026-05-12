import {
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type UseQueryOptions,
  type UseQueryResult,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import type { Bet, Cursor, ListForPariByUserParams, ListForUserParams, Page } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";

export type UseInfiniteBetsParams = Omit<ListForUserParams, "cursor"> & { pariId?: string };

export type UseInfiniteBetsOptions = Omit<
  UseInfiniteQueryOptions<
    Page<Bet>,
    Error,
    InfiniteData<Page<Bet>>,
    ReturnType<typeof toncastQueryKeys.betting.infiniteBets>,
    Cursor | null
  >,
  "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

/**
 * Bets a user has placed. With `pariId` → bets for that single pari; without
 * → cross-pari history. `userAddress` falls back to the SDK-level value.
 */
export function useBets(
  params: ListForUserParams & { pariId?: string } = {},
  options?: Omit<UseQueryOptions<Page<Bet>>, "queryKey" | "queryFn">,
): UseQueryResult<Page<Bet>> {
  const client = useToncastClient();
  const { pariId, ...rest } = params;
  return useQuery<Page<Bet>>({
    ...options,
    queryKey: toncastQueryKeys.betting.bets({ pariId, ...rest }),
    queryFn: ({ signal }) =>
      pariId
        ? client.bets.listForPariByUser({
            ...(rest as ListForPariByUserParams),
            pariId,
            signal,
          })
        : client.bets.listForUser({ ...rest, signal }),
  });
}

/**
 * Infinite cursor pagination for user bets. This is the preferred hook for UI
 * lists because TanStack Query owns page accumulation, refetches, and cache
 * resets instead of duplicating that lifecycle in components.
 */
export function useInfiniteBets(
  params: UseInfiniteBetsParams = {},
  options?: UseInfiniteBetsOptions,
): UseInfiniteQueryResult<InfiniteData<Page<Bet>>, Error> {
  const client = useToncastClient();
  const { pariId, ...rest } = params;
  return useInfiniteQuery<
    Page<Bet>,
    Error,
    InfiniteData<Page<Bet>>,
    ReturnType<typeof toncastQueryKeys.betting.infiniteBets>,
    Cursor | null
  >({
    ...options,
    queryKey: toncastQueryKeys.betting.infiniteBets({ pariId, ...rest }),
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      pariId
        ? client.bets.listForPariByUser({
            ...(rest as Omit<ListForPariByUserParams, "cursor">),
            pariId,
            cursor: pageParam,
            signal,
          })
        : client.bets.listForUser({ ...rest, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor !== null ? lastPage.nextCursor : undefined,
  });
}
