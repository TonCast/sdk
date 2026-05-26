import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { ListParisParams, Page, Pari } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";

/**
 * One page of paris with TanStack-Query semantics (cache, dedup, refetch).
 * For an infinite-scroll feed use {@link useStreamList} with `fetchNextPage` /
 * `hasNextPage` (live WS + cursor pagination on the same stream).
 */
export function useParis(
  params: ListParisParams = {},
  options?: Omit<UseQueryOptions<Page<Pari>>, "queryKey" | "queryFn">,
): UseQueryResult<Page<Pari>> {
  const client = useToncastClient();
  return useQuery<Page<Pari>>({
    ...options,
    queryKey: toncastQueryKeys.paris.list(params),
    queryFn: ({ signal }) => client.paris.list({ ...params, signal }),
  });
}
