import type { Pari, StreamListParams } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";
import { type UseLiveStreamQueryResult, useLiveStreamQuery } from "./useLiveStreamQuery";

export interface UseStreamListOptions {
  enabled?: boolean;
  /**
   * When `true`, keeps the previous `data` snapshot visible while new `params`
   * load. Default `true`. Set `false` for infinite-scroll feeds that should
   * reset when the category / filter changes.
   */
  keepPreviousData?: boolean;
}

export type UseStreamListResult = UseLiveStreamQueryResult<Pari[]>;

/**
 * Live paris feed via `paris.streamList`. Returns the latest `Pari[]` snapshot;
 * WS reconnects, polling fallback, sequenceId dedup, and `pari_created`
 * localization happen inside the SDK.
 *
 * Streams are pooled by params inside the SDK. Pagination: `hasNextPage`,
 * `fetchNextPage`, `isFetchingNextPage` — backed by `ParisListStream.loadMore()`.
 */
export function useStreamList(
  params: StreamListParams = {},
  options?: UseStreamListOptions,
): UseStreamListResult {
  const client = useToncastClient();
  const { enabled, keepPreviousData = true } = options ?? {};
  return useLiveStreamQuery<Pari[]>({
    enabled,
    keepPreviousData,
    queryKey: toncastQueryKeys.paris.streamList(params),
    requestFn: () => client.paris.streamList(params),
  });
}
