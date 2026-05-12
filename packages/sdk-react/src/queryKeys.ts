import type { PriceCoinsOptions } from "@toncast/sdk";
import { serializeKey } from "./utils/serializeKey";

/**
 * Stable query-key builders for every hook in `@toncast/sdk-react`.
 *
 * Use these when calling `queryClient.prefetchQuery` / `setQueryData` /
 * `invalidateQueries` from outside the hooks — they guarantee the same
 * shape the hook itself emits, so prefetched data lands exactly where the
 * later `useQuery` reads from.
 *
 * Keys are namespaced under `["toncast", ...]`; integrators should never
 * construct them by hand.
 */
export const toncastQueryKeys = {
  betting: {
    summary: (pariId: string | null | undefined, opts: PriceCoinsOptions = {}) =>
      ["toncast", "betting", "summary", pariId ?? "_disabled", serializeKey(opts)] as const,
    quote: (params: unknown) => ["toncast", "betting", "quote", serializeKey(params)] as const,
    bets: (params?: { pariId?: string } & Record<string, unknown>) =>
      [
        "toncast",
        "betting",
        "bets",
        params?.pariId ? "byPari" : "byUser",
        serializeKey(params),
      ] as const,
    infiniteBets: (params?: { pariId?: string } & Record<string, unknown>) =>
      [
        "toncast",
        "betting",
        "bets",
        params?.pariId ? "byPari" : "byUser",
        "infinite",
        serializeKey(params),
      ] as const,
  },
  paris: {
    list: (params: unknown) => ["toncast", "paris", "list", serializeKey(params)] as const,
    streamList: (params: unknown) =>
      ["toncast", "paris", "streamList", serializeKey(params)] as const,
    detail: (pariId: string) => ["toncast", "paris", "detail", pariId] as const,
  },
  categories: (lang: string) => ["toncast", "categories", lang] as const,
  coins: (userAddress: string | null | undefined) =>
    ["toncast", "coins", userAddress ?? "_disconnected"] as const,
} as const;
