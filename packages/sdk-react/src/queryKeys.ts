import type { PriceCoinsOptions } from "@toncast/sdk";
import { serializeKey } from "./utils/serializeKey";

/** Options mirrored in `useMarketCapacity` query keys (`maxBudgetTon` is BigInt-safe). */
export type MarketCapacityKeyOpts = {
  maxBudgetTon?: bigint;
};

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
    /**
     * Prefix shared by `bets()` and `infiniteBets()` query keys. Use with
     * `queryClient.invalidateQueries({ queryKey: [...toncastQueryKeys.betting.betsInvalidationPrefix] })`
     * when you need to bust every user/pari bets cache (e.g. after placing a bet).
     *
     * Do **not** pass the full return value of `bets(...)` here: `infiniteBets` inserts an
     * extra `"infinite"` segment before `serializeKey`, so a full `bets` key is not a prefix
     * of infinite-query keys and those entries would not match.
     */
    betsInvalidationPrefix: ["toncast", "betting", "bets"] as const,
    marketCapacity: (sourceKey: string, isYes: boolean, opts: MarketCapacityKeyOpts = {}) =>
      ["toncast", "betting", "marketCapacity", sourceKey, isYes, serializeKey(opts)] as const,
  },
  paris: {
    list: (params: unknown) => ["toncast", "paris", "list", serializeKey(params)] as const,
    streamList: (params: unknown) =>
      ["toncast", "paris", "streamList", serializeKey(params)] as const,
    detail: (pariId: string | null | undefined) =>
      ["toncast", "paris", "detail", pariId ?? "_disabled"] as const,
    subscribe: (pariId: string | null | undefined, params: unknown = {}) =>
      ["toncast", "paris", "subscribe", pariId ?? "_disabled", serializeKey(params)] as const,
  },
  categories: (lang: string) => ["toncast", "categories", lang] as const,
  categoryFilters: (lang: string) => ["toncast", "category-filters", lang] as const,
  coins: {
    /** Pass `params.userAddress ?? client.getUserAddress() ?? null` to match `useCoins`. */
    list: (resolvedUserAddress: string | null) =>
      ["toncast", "coins", "list", resolvedUserAddress] as const,
  },
} as const;
