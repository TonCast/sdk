import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Bet, ListForPariByUserParams, ListForUserParams, Page } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";

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
