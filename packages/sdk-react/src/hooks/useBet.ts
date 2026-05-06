import {
  type UseMutationResult,
  type UseQueryResult,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type BetOptionFailureReason,
  type BetQuote,
  type BetSummary,
  type BreakdownTotals,
  breakdownTotals,
  calcWinnings,
  type CoinCapacity,
  type ConfirmedQuote,
  DEFAULT_WALLET_RESERVE,
  fixedTicketsForBudget,
  oddsLiquidity,
  ODDS_MAX,
  ODDS_MIN,
  ODDS_STEP,
  PARI_EXECUTION_FEE,
  sameSideMedianYesOdds,
  type PriceCoinsOptions,
  type QuoteCommon,
  sliderPositionToYesOdds,
  stepOdds,
  TON_ADDRESS,
  yesOddsToDecimalOdds,
  yesOddsToSliderPosition,
} from "@toncast/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToncastClient } from "../client/useToncastClient";
import { useBetQuote } from "./useBetQuote";
import type { UseObservableQueryResult } from "./useObservableQuery";
import { useBetSummary } from "./useBetSummary";
import { useConfirmBet } from "./useConfirmBet";

export type BetSide = "yes" | "no";
export type BetMode = "market" | "fixed" | "limit";

export interface UseBetParams {
  /** Pari id. Pass `null` to disable the entire flow. */
  pariId: string | null;
  /** Initial side. The hook owns the state — read `bet.side`, mutate via `bet.setSide`. */
  defaultSide?: BetSide;
  /** Initial bet mode. */
  defaultMode?: BetMode;
  /** Initial source coin address. `null` = auto-pick TON / first viable jetton. */
  defaultSource?: string | null;
  /** Initial yesOdds. Used only by `fixed` / `limit` modes; defaults to the
   *  best available counter-side leg once the summary loads. */
  defaultYesOdds?: number;
  /** Initial ticket count. Defaults to half of the wallet capacity once the
   *  summary loads (per `(coin, side)`). */
  defaultTickets?: number;
  /** Forwarded to {@link useBetSummary}. */
  priceCoinsOptions?: PriceCoinsOptions;
  /** Default 30s — staleTime on the summary query. */
  summaryStaleTime?: number;
  /** Default 5s — staleTime on the live quote query. */
  quoteStaleTime?: number;
}

export interface SliderProps {
  value: [number];
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onValueChange: (v: number[]) => void;
}

export interface StepperState {
  value: number;
  canIncrement: boolean;
  canDecrement: boolean;
  increment: () => void;
  decrement: () => void;
}

/** A single per-yesOdds row in the quote breakdown, enriched with display fields. */
export interface QuoteRow {
  yesOdds: number;
  tickets: number;
  /** Total cost including the per-entry execution fee. */
  cost: bigint;
  /** Cost without the execution fee — what the bettor actually pays for tickets. */
  stake: bigint;
  /** Decimal multiplier for the chosen side at this `yesOdds`. */
  decimalOdds: number;
}

export interface NormalizedQuote {
  underlying: UseQueryResult<BetQuote>;
  data: BetQuote | undefined;
  /** Tickets that match existing counter-side liquidity right now.
   *  Each row carries `stake` (cost without fee) and `decimalOdds` ready for display. */
  matched: QuoteRow[];
  /** Tickets posted as a new ask (waiting for opposite bets).
   *  Unifies `breakdown.placement` (market/fixed) and `breakdown.unmatched` (limit). */
  placed: QuoteRow | null;
  totalCost: bigint;
  /** TON the wallet must hold to sign — `totalCost` plus the SDK's wallet reserve
   *  for TON-funded bets. For jetton sources equals `totalCost`. */
  required: bigint;
  /** TON kept aside on the wallet so the user can still afford gas for the next
   *  transaction. Already factored into `required`; surfaced here so the UI can
   *  display it without importing `DEFAULT_WALLET_RESERVE`. `0n` for jetton sources. */
  walletReserve: bigint;
  /** Pre-computed UI totals: `{ matchedTickets, matchedTicketCost, stake, executionFee, total, ... }`. */
  totals: BreakdownTotals;
  decimalOdds: number;
  winnings: bigint;
  isFeasible: boolean;
  reason: BetOptionFailureReason | null;
}

export interface UseBetResult {
  // ─── State (controlled by the hook) ───────────────────────────────────────
  side: BetSide;
  setSide: (s: BetSide) => void;
  mode: BetMode;
  setMode: (m: BetMode) => void;
  source: string | null;
  setSource: (s: string | null) => void;
  yesOdds: number;
  setYesOdds: (n: number) => void;
  tickets: number;
  setTickets: (n: number) => void;

  // ─── Data ─────────────────────────────────────────────────────────────────
  summary: UseObservableQueryResult<BetSummary>;
  coins: CoinCapacity[];
  selectedCoin: CoinCapacity | null;

  // ─── Quote (normalised across modes) ──────────────────────────────────────
  quote: NormalizedQuote;

  // ─── Limits ───────────────────────────────────────────────────────────────
  minTickets: number;
  /** Hard cap for ticket inputs / steppers / sliders. For `market`/`limit`
   *  this is the wallet ceiling along the cheapest book legs; for `fixed`
   *  it's the cap at the chosen `yesOdds` bucket. */
  maxTickets: number;
  /** True when the order book has no counter-side liquidity for the current
   *  side in market mode.  Integrators should surface a "be the first to bet"
   *  prompt and offer Limit / Fixed as alternatives. */
  isBookEmpty: boolean;

  // ─── Source-coin amount helpers ───────────────────────────────────────────
  /** Source-coin amount of the current bet, in source-native units
   *  (raw nano-TON for TON, raw smallest-unit for jettons). Tracks `quote.totalCost`. */
  sourceAmount: bigint;
  /** Convert a TON amount to source-coin units using the live priced rate. */
  tonToSource: (tonAmount: bigint) => bigint;
  /** Convert a source-coin amount to its TON equivalent. */
  sourceToTon: (sourceUnits: bigint) => bigint;
  /** Snap a free-form source-coin input back to a whole-ticket count along
   *  the active book legs. Useful for Market mode's amount input `onBlur`. */
  ticketsForSourceAmount: (sourceUnits: bigint) => number;

  // ─── UI props ─────────────────────────────────────────────────────────────
  /** Spread onto a Radix-like Slider. Slider value is "decimal-multiplier-friendly":
   *  low coefficient on the left, high on the right. */
  oddsSliderProps: SliderProps;
  /** Spread onto a Radix-like Slider. Tickets, capped by wallet capacity. */
  ticketsSliderProps: SliderProps;
  oddsStepper: StepperState;
  ticketsStepper: StepperState;
  /** Pre-mapped slider positions (`leftPct` 0..100) for every yesOdds bucket
   *  with counter-side liquidity. Drop in as absolute-positioned dots. */
  liquidityMarkers: { leftPct: number; tickets: number; yesOdds: number }[];

  // ─── Action ───────────────────────────────────────────────────────────────
  confirm: UseMutationResult<ConfirmedQuote, Error, { quote: BetQuote; params?: QuoteCommon }>;
  /** Convenience: run `confirm` with the current quote. Does NOT refetch — call
   *  `bet.refresh()` after `tc.sendTransaction(...)` resolves so the wallet
   *  balances reflect the on-chain state. */
  confirmCurrent: () => Promise<ConfirmedQuote | null>;
  /** Re-fetch summary (pari + oddsState + priced wallet coins). Call after the
   *  TonConnect transaction is signed and broadcast so the UI shows the new
   *  wallet balance and updated order book. Safe to call any time. */
  refresh: () => Promise<void>;
}

/**
 * One-call helper for the canonical "place a bet" UX across **all three modes**
 * (market / fixed / limit).
 *
 * Owns side / mode / source / yesOdds / tickets state internally and exposes
 * setters. Returns ready-to-spread Slider props, +/− stepper bundles, a
 * normalised `quote` (matched + placed always in the same shape regardless of
 * mode), wallet-aware ticket caps and pre-mapped liquidity markers.
 *
 * Integrators should rarely need to import any odds helpers from `@toncast/sdk`
 * directly — everything UI-facing is bundled here.
 */
export function useBet(params: UseBetParams): UseBetResult {
  const client = useToncastClient();
  const {
    pariId,
    defaultSide = "yes",
    defaultMode = "market",
    defaultSource = null,
    defaultYesOdds,
    defaultTickets,
    priceCoinsOptions,
    summaryStaleTime = 30_000,
    quoteStaleTime = 5_000,
  } = params;

  const [side, setSide] = useState<BetSide>(defaultSide);
  const [mode, setMode] = useState<BetMode>(defaultMode);
  const [requestedSource, setRequestedSource] = useState<string | null>(defaultSource);
  const [yesOdds, setYesOdds] = useState<number>(defaultYesOdds ?? ODDS_MIN);
  // Per (coin, side) ticket count — capacities differ between YES and NO.
  const [ticketsByKey, setTicketsByKey] = useState<Record<string, number>>({});

  const isYes = side === "yes";

  // `summaryStaleTime` is intentionally NOT forwarded — `subscribeSummary`
  // is a long-lived two-phase stream that the SDK pool keeps warm; staleness
  // semantics don't apply.
  const summary = useBetSummary(pariId, priceCoinsOptions);
  // Capacities = fully-priced coins (always selectable). loadingCoins =
  // wallet jettons whose pricing is still being computed (phase-1 of
  // `subscribeSummary`); we include them in `coins` as non-feasible
  // placeholder capacities so the UI shows them as "loading…" without
  // hiding their existence.
  const coins = useMemo<CoinCapacity[]>(() => {
    const capacities = summary.data?.capacities ?? [];
    const loading = summary.data?.loadingCoins ?? [];
    if (loading.length === 0) return capacities;
    const placeholders: CoinCapacity[] = loading.map((c) => ({
      source: { address: c.address, amount: c.amount, symbol: c.symbol, decimals: c.decimals },
      feasible: false,
      reason: "pricing_in_progress",
      minBetTon: 0n,
      maxBetTon: 0n,
    }));
    return [...capacities, ...placeholders];
  }, [summary.data]);

  // Auto-pick a source: caller-provided one if still viable, else TON, else
  // first viable jetton.
  const source = useMemo<string | null>(() => {
    if (coins.length === 0) return requestedSource;
    if (requestedSource) {
      const cap = coins.find((c) => c.source.address === requestedSource);
      if (cap?.feasible) return requestedSource;
    }
    const ton = coins.find((c) => c.source.address === TON_ADDRESS);
    if (ton?.feasible) return ton.source.address;
    const fallback = coins.find((c) => c.feasible);
    return fallback?.source.address ?? null;
  }, [coins, requestedSource]);

  const selectedCoin = useMemo<CoinCapacity | null>(() => {
    if (!source) return null;
    return coins.find((c) => c.source.address === source) ?? null;
  }, [coins, source]);

  const sideMarket = isYes ? summary.data?.marketYes : summary.data?.marketNo;
  const legs = sideMarket?.legs ?? [];

  // Ticket key per (coin, side); `tickets` reads through this map so YES↔NO
  // toggle preserves the prior count for each side.
  const ticketsKey = source ? `${source}:${isYes ? "y" : "n"}` : null;
  const tickets = ticketsKey ? (ticketsByKey[ticketsKey] ?? 0) : 0;
  const setTickets = useCallback(
    (n: number) => {
      if (!ticketsKey) return;
      setTicketsByKey((prev) => ({ ...prev, [ticketsKey]: Math.max(0, Math.trunc(n)) }));
    },
    [ticketsKey],
  );

  // Midpoint yesOdds used as the fair first-offer price on an empty book.
  const ODDS_MID = Math.round((ODDS_MIN + ODDS_MAX) / 2); // 50

  const isBookEmpty = selectedCoin !== null && legs.length === 0;

  // Seed default tickets to 50% of wallet capacity per (coin, side), or to
  // `defaultTickets` if provided.
  const seededRef = useRef<Set<string>>(new Set());
  const affordableInWallet = useMemo<number>(() => {
    if (!selectedCoin || legs.length === 0) return 0;
    return client.betting.ticketsForBudget(legs, selectedCoin.maxBetTon);
  }, [client, selectedCoin, legs]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: first-sight seed only.
  useEffect(() => {
    if (!ticketsKey || !selectedCoin) return;
    if (seededRef.current.has(ticketsKey)) return;
    if (ticketsByKey[ticketsKey] !== undefined) {
      seededRef.current.add(ticketsKey);
      return;
    }
    // Seed budget = book-walk capacity when there's matching counter-side
    // liquidity, otherwise the wallet's fixed-price capacity at the same-side
    // median (matches the empty-book branch in `maxTickets` below).
    let cap = affordableInWallet;
    if (cap <= 0) {
      const oddsState = summary.data?.oddsState;
      const median = oddsState ? sameSideMedianYesOdds(oddsState, isYes) : null;
      cap = fixedTicketsForBudget(selectedCoin.maxBetTon, median ?? ODDS_MID, isYes);
    }
    if (cap <= 0) return;
    const initial = defaultTickets ?? Math.max(1, Math.floor(cap / 2));
    seededRef.current.add(ticketsKey);
    setTicketsByKey((prev) => ({ ...prev, [ticketsKey]: initial }));
  }, [ticketsKey, selectedCoin, affordableInWallet, isYes]);

  // Seed yesOdds to the best counter-side leg on mode switch (Limit/Fixed
  // only; Market doesn't use it). `legs` is sorted "best for the chosen side
  // first" by the SDK — so legs[0] is always the highest-multiplier offer.
  // When the counter side is empty we still want a sensible default that's
  // NEAR the existing market — the median of same-side existing orders
  // ("where the action is") beats a neutral 50 %. Falls back to `ODDS_MID`
  // only when both sides are completely empty.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mode+book seed.
  useEffect(() => {
    if (defaultYesOdds !== undefined) return;
    if (mode === "market") return;
    const legsNow = legs;
    if (legsNow.length > 0) {
      const best = legsNow[0]?.yesOdds;
      if (best !== undefined) setYesOdds(best);
      return;
    }
    const oddsState = summary.data?.oddsState;
    const median = oddsState ? sameSideMedianYesOdds(oddsState, isYes) : null;
    setYesOdds(median ?? ODDS_MID);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isBookEmpty]);

  // ─── Quote ────────────────────────────────────────────────────────────────
  const quoteParams = useMemo(() => {
    if (!summary.data || !selectedCoin || tickets <= 0 || !pariId) return null;
    const common = {
      pariId,
      isYes,
      source: selectedCoin.source.address,
      pricedCoins: summary.data.pricedCoins,
    };
    if (mode === "market") {
      // Empty counter side: a "market" order has nothing to match against.
      // Route it as a limit order at the same-side median (or 50 % when even
      // the same side is empty) so the order lands at "where the market is",
      // not at the neutral midpoint.
      if (isBookEmpty) {
        const median = sameSideMedianYesOdds(summary.data.oddsState, isYes);
        return {
          mode: "limit" as const,
          ...common,
          worstYesOdds: median ?? ODDS_MID,
          ticketsCount: tickets,
          oddsState: summary.data.oddsState,
        };
      }
      return {
        mode: "market" as const,
        ...common,
        marketTickets: tickets,
        oddsState: summary.data.oddsState,
      };
    }
    if (mode === "limit") {
      return {
        mode: "limit" as const,
        ...common,
        worstYesOdds: yesOdds,
        ticketsCount: tickets,
        oddsState: summary.data.oddsState,
      };
    }
    return {
      mode: "fixed" as const,
      ...common,
      yesOdds,
      ticketsCount: tickets,
      oddsState: summary.data.oddsState,
    };
  }, [summary.data, selectedCoin, tickets, pariId, isYes, mode, yesOdds]);

  const underlyingQuote = useBetQuote(quoteParams, { staleTime: quoteStaleTime });

  const quote = useMemo<NormalizedQuote>(() => {
    const data = underlyingQuote.data;
    if (!data) {
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
    const rawPlaced = data.breakdown.placement ?? data.breakdown.unmatched ?? null;
    const enrich = (row: { yesOdds: number; tickets: number; cost: bigint }): QuoteRow => ({
      yesOdds: row.yesOdds,
      tickets: row.tickets,
      cost: row.cost,
      stake: row.cost - PARI_EXECUTION_FEE,
      decimalOdds: yesOddsToDecimalOdds(row.yesOdds, isYes),
    });
    const isTon = selectedCoin?.source.address === TON_ADDRESS;
    const reserve = isTon ? DEFAULT_WALLET_RESERVE : 0n;
    return {
      underlying: underlyingQuote,
      data,
      matched: data.breakdown.matched.map(enrich),
      placed: rawPlaced ? enrich(rawPlaced) : null,
      totalCost: data.totalCost,
      required: data.totalCost + reserve,
      walletReserve: reserve,
      totals: breakdownTotals(data),
      decimalOdds: yesOddsToDecimalOdds(yesOdds, isYes),
      winnings: calcWinnings(data.bets, 0),
      isFeasible: data.option.feasible,
      reason: data.option.feasible ? null : data.option.reason,
    };
  }, [underlyingQuote, selectedCoin, yesOdds, isYes]);

  // ─── Limits ──────────────────────────────────────────────────────────────
  const minTickets = 1;
  const maxTickets = useMemo(() => {
    if (!selectedCoin) return 0;
    if (mode === "fixed") return fixedTicketsForBudget(selectedCoin.maxBetTon, yesOdds, isYes);
    // Empty counter side: affordableInWallet is 0 (no legs to price against).
    // Use fixedTicketsForBudget at the closest sensible price so the user
    // can still place the first order. Same logic as the yesOdds seed —
    // prefer the same-side median, fall back to the middle of the range.
    if (isBookEmpty) {
      let oddsForCap = mode === "market" ? ODDS_MID : yesOdds;
      if (mode === "market") {
        const oddsState = summary.data?.oddsState;
        const median = oddsState ? sameSideMedianYesOdds(oddsState, isYes) : null;
        if (median !== null) oddsForCap = median;
      }
      return fixedTicketsForBudget(selectedCoin.maxBetTon, oddsForCap, isYes);
    }
    return affordableInWallet;
  }, [selectedCoin, mode, yesOdds, isYes, affordableInWallet, isBookEmpty, ODDS_MID, summary.data]);

  // ─── Source-coin conversion (bound to currently selected coin) ───────────
  const sourcePriced = useMemo(
    () => summary.data?.pricedCoins.find((p) => p.address === source) ?? null,
    [summary.data, source],
  );
  const isTonSource = source === TON_ADDRESS;

  const tonToSource = useCallback(
    (tonAmount: bigint): bigint => {
      if (isTonSource) return tonAmount;
      if (!sourcePriced) return 0n;
      return client.betting.convertTonToSource(sourcePriced, tonAmount);
    },
    [client, isTonSource, sourcePriced],
  );
  const sourceToTon = useCallback(
    (sourceUnits: bigint): bigint => {
      if (isTonSource) return sourceUnits;
      if (!sourcePriced) return 0n;
      return client.betting.convertSourceToTon(sourcePriced, sourceUnits);
    },
    [client, isTonSource, sourcePriced],
  );

  /**
   * Source-coin amount of the current bet, in source-native units (raw TON
   * nano for TON, raw jetton smallest-unit for jettons). Tracks the live
   * `quote.totalCost` and the currently selected coin.
   */
  const sourceAmount = useMemo<bigint>(
    () => tonToSource(quote.totalCost),
    [tonToSource, quote.totalCost],
  );

  /**
   * Snap a coin-amount input back to a whole-ticket count using the active
   * book legs. Used by Market mode's free-form amount input.
   */
  const ticketsForSourceAmount = useCallback(
    (sourceUnits: bigint): number => {
      const tonBudget = sourceToTon(sourceUnits);
      return client.betting.ticketsForBudget(legs, tonBudget);
    },
    [client, sourceToTon, legs],
  );

  // ─── UI props ────────────────────────────────────────────────────────────
  const oddsSliderProps: SliderProps = useMemo(
    () => ({
      value: [yesOddsToSliderPosition(yesOdds, isYes)],
      min: ODDS_MIN,
      max: ODDS_MAX,
      step: ODDS_STEP,
      onValueChange: (v) => {
        if (v[0] !== undefined) setYesOdds(sliderPositionToYesOdds(v[0], isYes));
      },
    }),
    [yesOdds, isYes],
  );

  const ticketsSliderProps: SliderProps = useMemo(
    () => ({
      value: [Math.min(Math.max(tickets, 1), Math.max(1, maxTickets))],
      min: 1,
      max: Math.max(1, maxTickets),
      step: 1,
      disabled: maxTickets <= 0,
      onValueChange: (v) => {
        if (v[0] !== undefined) setTickets(Math.max(1, Math.trunc(v[0])));
      },
    }),
    [tickets, maxTickets, setTickets],
  );

  const oddsStepper: StepperState = useMemo(() => {
    const next = (dir: "improve" | "degrade") => stepOdds(yesOdds, isYes, dir);
    return {
      value: yesOdds,
      canIncrement: next("improve") !== yesOdds,
      canDecrement: next("degrade") !== yesOdds,
      increment: () => setYesOdds(next("improve")),
      decrement: () => setYesOdds(next("degrade")),
    };
  }, [yesOdds, isYes]);

  const ticketsStepper: StepperState = useMemo(() => {
    const cap = maxTickets > 0 ? maxTickets : Number.POSITIVE_INFINITY;
    return {
      value: tickets,
      canIncrement: tickets < cap,
      canDecrement: tickets > 1,
      increment: () => setTickets(Math.min(tickets + 1, cap)),
      decrement: () => setTickets(Math.max(1, tickets - 1)),
    };
  }, [tickets, maxTickets, setTickets]);

  const liquidityMarkers = useMemo(() => {
    if (!summary.data) return [];
    return oddsLiquidity(summary.data.oddsState, isYes).map(({ yesOdds: yo, tickets: count }) => ({
      yesOdds: yo,
      tickets: count,
      leftPct:
        ((yesOddsToSliderPosition(yo, isYes) - ODDS_MIN) / (ODDS_MAX - ODDS_MIN)) * 100,
    }));
  }, [summary.data, isYes]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const confirm = useConfirmBet();
  const qc = useQueryClient();
  const confirmCurrent = useCallback(async (): Promise<ConfirmedQuote | null> => {
    if (!quote.data || !quoteParams) return null;
    // Pass `quoteParams` explicitly: the SDK normally tracks them via a
    // WeakMap on the quote object, but that can be lost across HMR / SDK
    // client re-instantiation. Forwarding the live params makes confirm
    // robust against stale tracking.
    return confirm.mutateAsync({ quote: quote.data, params: quoteParams });
  }, [quote.data, quoteParams, confirm]);

  const refresh = useCallback(async (): Promise<void> => {
    // Drop the SDK's coin cache so the next `summary` fetch re-prices wallet
    // balances against fresh on-chain state, then re-run summary.
    client.coins.invalidate();
    await summary.refetch();
    void qc.invalidateQueries({ queryKey: ["toncast", "betting"] });
  }, [client, summary, qc]);

  return {
    side,
    setSide,
    mode,
    setMode,
    source,
    setSource: setRequestedSource,
    yesOdds,
    setYesOdds,
    tickets,
    setTickets,
    summary,
    coins,
    selectedCoin,
    quote,
    minTickets,
    maxTickets,
    isBookEmpty,
    sourceAmount,
    tonToSource,
    sourceToTon,
    ticketsForSourceAmount,
    oddsSliderProps,
    ticketsSliderProps,
    oddsStepper,
    ticketsStepper,
    liquidityMarkers,
    confirm,
    confirmCurrent,
    refresh,
  };
}
