import type { UseQueryResult } from "@tanstack/react-query";
import {
  type BetQuote,
  type BetSummary,
  type CoinCapacity,
  TON_ADDRESS,
  yesOddsToDecimalOdds,
} from "@toncast/sdk";
import {
  breakdownTotals,
  calcWinnings,
  DEFAULT_WALLET_RESERVE,
  ODDS_MAX,
  ODDS_MIN,
  PARI_EXECUTION_FEE,
} from "@toncast/sdk/betting";
import {
  fixedTicketsForBudget,
  oddsLiquidity,
  sameSideMedianYesOdds,
  yesOddsToSliderPosition,
} from "@toncast/sdk/core";
import type { BetMode, NormalizedQuote, QuoteRow } from "./useBet";

export const ODDS_MID = Math.round((ODDS_MIN + ODDS_MAX) / 2);

/** On-chain ticket counts are uint32 — keep UI state within the same bounds. */
export const MAX_UINT32_TICKETS = 4_294_967_295;

/** Clamp a raw ticket input to [1 … min(maxTickets, uint32 max)]. */
export function clampTicketCount(n: number, maxTickets: number): number {
  const truncated = Math.max(1, Math.trunc(n));
  const cap = maxTickets > 0 ? maxTickets : MAX_UINT32_TICKETS;
  return Math.min(truncated, cap, MAX_UINT32_TICKETS);
}

export function buildCoinOptions(summary: BetSummary | undefined): CoinCapacity[] {
  const capacities = summary?.capacities ?? [];
  const loading = summary?.loadingCoins ?? [];
  if (loading.length === 0) return capacities;
  const placeholders: CoinCapacity[] = loading.map((coin) => ({
    source: {
      address: coin.address,
      amount: coin.amount,
      symbol: coin.symbol,
      decimals: coin.decimals,
    },
    feasible: false,
    reason: "pricing_in_progress",
    minBetTon: 0n,
    maxBetTon: 0n,
  }));
  return [...capacities, ...placeholders];
}

export function pickSource(coins: CoinCapacity[], requestedSource: string | null): string | null {
  if (coins.length === 0) return requestedSource;
  if (requestedSource) {
    const requested = coins.find((coin) => coin.source.address === requestedSource);
    if (requested) return requestedSource;
  }
  const ton = coins.find((coin) => coin.source.address === TON_ADDRESS);
  if (ton) return ton.source.address;
  return coins[0]?.source.address ?? null;
}

/** TON budget used only to walk the order book when computing UI ticket caps. */
export const BOOK_EXPLORATION_BUDGET_NANOTON = 1000n * 1_000_000_000n;

/** Max tickets the UI may explore along the book, ignoring wallet balance. */
export function getBookExplorationMaxTickets(params: {
  mode: BetMode;
  yesOdds: number;
  isYes: boolean;
  isBookEmpty: boolean;
  oddsState: BetSummary["oddsState"] | undefined;
  /** Market-mode cap from `ticketsForBudget(legs, BOOK_EXPLORATION_BUDGET_NANOTON)`. */
  bookAffordableTickets: number;
}): number {
  const { mode, yesOdds, isYes, isBookEmpty, oddsState, bookAffordableTickets } = params;
  if (mode === "market" && !isBookEmpty) return bookAffordableTickets;
  if (mode === "fixed" || mode === "limit") {
    return fixedTicketsForBudget(BOOK_EXPLORATION_BUDGET_NANOTON, yesOdds, isYes);
  }
  const median = oddsState ? sameSideMedianYesOdds(oddsState, isYes) : null;
  return fixedTicketsForBudget(BOOK_EXPLORATION_BUDGET_NANOTON, median ?? ODDS_MID, isYes);
}

export function normalizeQuote(params: {
  underlyingQuote: UseQueryResult<BetQuote>;
  selectedCoin: CoinCapacity | null;
  yesOdds: number;
  isYes: boolean;
  /** Referral percentage (integer 0–7) — deducted from displayed winnings. */
  referralPct?: number;
}): NormalizedQuote {
  const { underlyingQuote, selectedCoin, yesOdds, isYes, referralPct = 0 } = params;
  const data = underlyingQuote.data;
  if (!data) return emptyNormalizedQuote(underlyingQuote, yesOdds, isYes);

  const rawPlaced = data.breakdown.placement ?? data.breakdown.unmatched ?? null;
  const isTon = selectedCoin?.source.address === TON_ADDRESS;
  const reserve = isTon ? DEFAULT_WALLET_RESERVE : 0n;
  return {
    underlying: underlyingQuote,
    data,
    matched: data.breakdown.matched.map((row) => enrichQuoteRow(row, isYes)),
    placed: rawPlaced ? enrichQuoteRow(rawPlaced, isYes) : null,
    totalCost: data.totalCost,
    required: data.totalCost + reserve,
    walletReserve: reserve,
    totals: breakdownTotals(data),
    decimalOdds: yesOddsToDecimalOdds(yesOdds, isYes),
    winnings: calcWinnings(data.bets, referralPct),
    isFeasible: data.option.feasible,
    reason: data.option.feasible ? null : data.option.reason,
  };
}

/** Wallet-funded ticket cap (min bet, balance, book walk with `maxBetTon`). */
export function getWalletMaxTickets(params: {
  selectedCoin: CoinCapacity | null;
  mode: BetMode;
  yesOdds: number;
  isYes: boolean;
  affordableInWallet: number;
  isBookEmpty: boolean;
  oddsState: BetSummary["oddsState"] | undefined;
}): number {
  const { selectedCoin, mode, yesOdds, isYes, affordableInWallet, isBookEmpty, oddsState } = params;
  if (!selectedCoin) return 0;
  // Fixed and Limit both place unmatched tickets at the chosen yesOdds, so the
  // ticket-count cap must track yesOdds changes for both modes.
  if (mode === "fixed" || mode === "limit")
    return fixedTicketsForBudget(selectedCoin.maxBetTon, yesOdds, isYes);
  // Market mode: walk the actual book legs for the tightest affordable count.
  if (!isBookEmpty) return affordableInWallet;

  const median = oddsState ? sameSideMedianYesOdds(oddsState, isYes) : null;
  return fixedTicketsForBudget(selectedCoin.maxBetTon, median ?? ODDS_MID, isYes);
}

export function getLiquidityMarkers(
  summary: BetSummary | undefined,
  isYes: boolean,
): { leftPct: number; tickets: number; yesOdds: number }[] {
  if (!summary) return [];
  return oddsLiquidity(summary.oddsState, isYes).map(
    ({ yesOdds, tickets }: { yesOdds: number; tickets: number }) => ({
      yesOdds,
      tickets,
      leftPct: ((yesOddsToSliderPosition(yesOdds, isYes) - ODDS_MIN) / (ODDS_MAX - ODDS_MIN)) * 100,
    }),
  );
}

function emptyNormalizedQuote(
  underlyingQuote: UseQueryResult<BetQuote>,
  yesOdds: number,
  isYes: boolean,
): NormalizedQuote {
  return {
    underlying: underlyingQuote,
    data: undefined,
    matched: [],
    placed: null,
    totalCost: 0n,
    required: 0n,
    walletReserve: 0n,
    totals: {
      matchedTickets: 0,
      matchedTicketCost: 0n,
      placementTickets: 0,
      placementTicketCost: 0n,
      executionFee: 0n,
      stake: 0n,
      total: 0n,
    },
    decimalOdds: yesOddsToDecimalOdds(yesOdds, isYes),
    winnings: 0n,
    isFeasible: false,
    reason: null,
  };
}

function enrichQuoteRow(
  row: { yesOdds: number; tickets: number; cost: bigint },
  isYes: boolean,
): QuoteRow {
  return {
    yesOdds: row.yesOdds,
    tickets: row.tickets,
    cost: row.cost,
    stake: row.cost - PARI_EXECUTION_FEE,
    decimalOdds: yesOddsToDecimalOdds(row.yesOdds, isYes),
  };
}
