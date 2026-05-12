// Provider + context
export { ToncastProvider, type ToncastProviderProps } from "./client/ToncastProvider";
export { useToncastClient } from "./client/useToncastClient";
// Betting — one unified hook covers market / fixed / limit
export {
  type BetMode,
  type BetSide,
  type NormalizedQuote,
  type SliderProps,
  type StepperState,
  type UseBetParams,
  type UseBetResult,
  useBet,
} from "./hooks/useBet";
// Lower-level betting building blocks (advanced consumers writing custom hooks)
export { type UseBetQuoteParams, useBetQuote } from "./hooks/useBetQuote";
export { useBetSummary } from "./hooks/useBetSummary";
// Read hooks (REST → TanStack useQuery)
export {
  type UseInfiniteBetsOptions,
  type UseInfiniteBetsParams,
  useBets,
  useInfiniteBets,
} from "./hooks/useBets";
export { useCategories, useCategoryFilters } from "./hooks/useCategories";
export { useCoins } from "./hooks/useCoins";
export { useConfirmBet } from "./hooks/useConfirmBet";
// Generic Observable adapter (for custom Observables; bake your own hook on top)
export {
  type LiveQueryStatus,
  type LiveStream,
  type UseLiveStreamQueryOptions,
  type UseLiveStreamQueryResult,
  useLiveStreamQuery,
} from "./hooks/useLiveStreamQuery";
export { useMarketCapacity } from "./hooks/useMarketCapacity";
export {
  type UseObservableQueryOptions,
  type UseObservableQueryResult,
  useObservableQuery,
} from "./hooks/useObservableQuery";
export { usePari } from "./hooks/usePari";
export { useParis } from "./hooks/useParis";
// Live hooks (stream snapshots → useSyncExternalStore)
export { useStreamList } from "./hooks/useStreamList";
export { useSubscribe } from "./hooks/useSubscribe";
// TonConnect bridge (peer-dep)
export { useTonConnectClient } from "./hooks/useTonConnectClient";
// Language management — single source of truth for app-wide locale
export { type UseToncastLanguageResult, useToncastLanguage } from "./hooks/useToncastLanguage";
// Query-key builders for prefetch / invalidate / setQueryData
export { type MarketCapacityKeyOpts, toncastQueryKeys } from "./queryKeys";
