import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Pari } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";

/**
 * Single pari by id. Pass `null`/`undefined` to disable (the query stays idle
 * and `data` remains `undefined`). For a live view prefer {@link useSubscribe}.
 */
export function usePari(
  pariId: string | null | undefined,
  options?: Omit<UseQueryOptions<Pari>, "queryKey" | "queryFn" | "enabled">,
): UseQueryResult<Pari> {
  const client = useToncastClient();
  return useQuery<Pari>({
    ...options,
    queryKey: toncastQueryKeys.paris.detail(pariId),
    queryFn: ({ signal }) => client.paris.get(pariId as string, signal),
    enabled: Boolean(pariId),
  });
}
