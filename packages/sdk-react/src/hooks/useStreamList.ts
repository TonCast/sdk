import type { Pari, StreamListParams } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";
import { type UseLiveStreamQueryResult, useLiveStreamQuery } from "./useLiveStreamQuery";

/**
 * Live, paginated paris feed via WS. Returns the latest `Pari[]` snapshot
 * (TanStack Query's `data`); WS reconnects, polling fallback, sequenceId dedup,
 * and `pari_created` localization happen inside the SDK.
 *
 * Streams are pooled by params inside the SDK, so re-mounts and same-params
 * re-renders never spawn a fresh fetch / WS handshake. When `params` change
 * (e.g. category switch) we keep the **previous** snapshot on screen until the
 * new one's initial fetch settles — no visible loading flash. The shared
 * `/ws/pari-list` socket stays connected across all categories.
 */
export function useStreamList(
  params: StreamListParams = {},
  options?: { enabled?: boolean; keepPreviousData?: boolean },
): UseLiveStreamQueryResult<Pari[]> {
  const client = useToncastClient();
  return useLiveStreamQuery<Pari[]>({
    keepPreviousData: true,
    ...options,
    queryKey: toncastQueryKeys.paris.streamList(params),
    requestFn: () => client.paris.streamList(params),
  });
}
