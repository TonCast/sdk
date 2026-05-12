// Re-exports of `@toncast/tx-sdk` so consumers can use one import root.
// `TonClient` here is `Client` from `@ston-fi/sdk` (extends `@ton/ton`'s
// TonClient) — same instance tx-sdk accepts. Drop-in compatible:
//   `new TonClient({ endpoint: "..." })` works identically.
export type {
  BetOptionFailureReason,
  BetQuote,
  BreakdownTotals,
  BuildJettonBetTxParams,
  BuildTonBetTxParams,
  MarketStrategyResult,
  OddsState,
  PricedCoin,
  TxParams,
} from "@toncast/tx-sdk";
export {
  availableForBet,
  availableTickets,
  breakdownTotals,
  buildJettonBetTx,
  buildTonBetTx,
  calcBetCost,
  calcWinnings,
  computeFixedBets,
  computeLimitBets,
  computeMarketBets,
  DEFAULT_SLIPPAGE,
  DEFAULT_WALLET_RESERVE,
  ODDS_MAX,
  ODDS_MIN,
  ODDS_STEP,
  PARI_EXECUTION_FEE,
  TONCAST_PROXY_ADDRESS,
  TonClient,
  ToncastBetError,
  ticketCost,
  yesOddsToDecimalOdds,
  yesOddsToProbabilityPct,
} from "@toncast/tx-sdk";
export {
  type BetSummary,
  type CoinCapacity,
  type ConfirmedQuote,
  type ConfirmQuoteParams,
  type MarketCapacity,
  type PriceCoinsOptions,
  type QuoteCommon,
  type QuoteFixedBetParams,
  type QuoteLimitBetParams,
  type QuoteMarketBetParams,
  TON_ADDRESS,
  toTonConnectMessage,
  toTonConnectMessages,
} from "./betting/placeBet";
export {
  type BetReasonContext,
  betQuoteReasonKey,
  formatBetQuoteReason,
} from "./betting/reasons";
export type {
  Logger,
  ReferralConfig,
  TonConnectMessage,
  TonConnectTransaction,
  ToncastClientOptions,
} from "./client/config";
export { ToncastClient } from "./client/ToncastClient";
export {
  ToncastApiError,
  ToncastError,
  ToncastValidationError,
  ToncastWsError,
} from "./errors";
export {
  DEFAULT_LANGUAGE,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "./i18n/languages";
export type {
  BetsCursor,
  ListForPariByUserParams,
  ListForUserParams,
} from "./resources/bets";
export { ALL_CATEGORY_FILTER } from "./resources/categories";
export type { AvailableCoin, ListCoinsParams } from "./resources/coins";
export {
  DEFAULT_PARI_CHART_PARAMS,
  type PariStream,
  type PariStreamSnapshot,
  type PariStreamStatus,
  type SubscribePariParams,
} from "./resources/pari-stream";
export type {
  CoefficientHistoryParams,
  ListParisParams,
  ParisCursor,
  ParisFeed,
} from "./resources/paris";
export type {
  ParisListStream,
  ParisStreamStatus,
  StreamListParams,
} from "./resources/paris-stream";
export * from "./types";
export {
  parseTonAddress,
  type TonAddressString,
} from "./utils/address";
export {
  firstValue,
  fromPromise,
  type Observer,
  type Subscribable,
  type Subscription,
  ToncastObservable,
} from "./utils/observable";
export {
  canStepOdds,
  fixedTicketsForBudget,
  oddsLiquidity,
  orderBookLadder,
  sameSideMedianYesOdds,
  sliderPositionToYesOdds,
  stepOdds,
  yesOddsToSliderPosition,
} from "./utils/odds";
export type { Cursor, Page } from "./utils/pagination";
export { DEFAULT_PARI_COVER_VARIANT, pariCoverUrl } from "./utils/pari-image";
export { formatUnits, parseUnits } from "./utils/units";
export { type CreateTonClientOptions, createTonClient } from "./wallet/createTonClient";
export {
  type DiscoveredJetton,
  discoverJettons,
  type JettonDiscoveryOptions,
} from "./wallet/jetton-discovery";
export type {
  BetEvent,
  BetPlacedWithOddsMessage,
  CoefficientChangedMessage,
  PariIncomingMessage,
  PariPausedMessage,
  PariResultSetMessage,
  PariUpdatedMessage,
} from "./ws/pari-protocol";
