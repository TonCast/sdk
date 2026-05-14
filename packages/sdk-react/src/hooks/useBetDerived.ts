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
    if (requested?.feasible) return requestedSource;
  }
  const ton = coins.find((coin) => coin.source.address === TON_ADDRESS);
  if (ton?.feasible) return ton.source.address;
  return coins.find((coin) => coin.feasible)?.source.address ?? null;
}

export function normalizeQuote(params: {
  underlyingQuote: UseQueryResult<BetQuote>;
  selectedCoin: CoinCapacity | null;
  yesOdds: number;
  isYes: boolean;
}): NormalizedQuote {
  const { underlyingQuote, selectedCoin, yesOdds, isYes } = params;
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
    winnings: calcWinnings(data.bets, 0),
    isFeasible: data.option.feasible,
    reason: data.option.feasible ? null : data.option.reason,
  };
}

export function getMaxTickets(params: {
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
  if (mode === "fixed") return fixedTicketsForBudget(selectedCoin.maxBetTon, yesOdds, isYes);
  if (!isBookEmpty) return affordableInWallet;

  const median = mode === "market" && oddsState ? sameSideMedianYesOdds(oddsState, isYes) : null;
  const oddsForCap = median ?? (mode === "market" ? ODDS_MID : yesOdds);
  return fixedTicketsForBudget(selectedCoin.maxBetTon, oddsForCap, isYes);
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
