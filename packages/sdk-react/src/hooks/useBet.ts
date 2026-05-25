import { type UseMutationResult, type UseQueryResult, useQueryClient } from "@tanstack/react-query";
import {
  type BetQuote,
  type BetSummary,
  type CoinCapacity,
  type ConfirmedQuote,
  type ConfirmQuoteParams,
  type PriceCoinsOptions,
  TON_ADDRESS,
} from "@toncast/sdk";
import {
  type BetOptionFailureReason,
  type BreakdownTotals,
  ODDS_MAX,
  ODDS_MIN,
  ODDS_STEP,
} from "@toncast/sdk/betting";
import {
  fixedTicketsForBudget,
  sameSideMedianYesOdds,
  sliderPositionToYesOdds,
  stepOdds,
  yesOddsToSliderPosition,
} from "@toncast/sdk/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToncastClient } from "../client/useToncastClient";
import {
  buildCoinOptions,
  clampTicketCount,
  getLiquidityMarkers,
  getMaxTickets,
  normalizeQuote,
  ODDS_MID,
  pickSource,
} from "./useBetDerived";
import { useBetQuote } from "./useBetQuote";
import { useBetSummary } from "./useBetSummary";
import { useConfirmBet } from "./useConfirmBet";
import type { UseObservableQueryResult } from "./useObservableQuery";

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
  /** Default 5s — staleTime on the live quote query. */
  quoteStaleTime?: number;
  /** Referral percentage (integer 0–7) to deduct from displayed winnings.
   *  Pass the value from `widget.referral.pct` so the UI reflects the real
   *  net payout the bettor will receive on-chain. Defaults to 0. */
  referralPct?: number;
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
  /** Tickets after wallet / uint32 clamping — used for quotes and sliders. */
  effectiveTickets: number;
  /** True when the raw ticket input exceeds {@link maxTickets}. */
  ticketsOverCap: boolean;

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
  confirm: UseMutationResult<
    ConfirmedQuote,
    Error,
    { quote: BetQuote; params?: ConfirmQuoteParams }
  >;
  /** Convenience: run `confirm` with the current quote. Does NOT refetch — call
   *  `bet.refresh()` after `tc.sendTransaction(...)` resolves so the wallet
   *  balances reflect the on-chain state. */
  confirmCurrent: (ack: { financialRiskAcknowledged: true }) => Promise<ConfirmedQuote | null>;
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
    quoteStaleTime = 5_000,
    referralPct = 0,
  } = params;

  const [side, setSide] = useState<BetSide>(defaultSide);
  const [mode, setMode] = useState<BetMode>(defaultMode);
  const [requestedSource, setRequestedSource] = useState<string | null>(defaultSource);
  const [yesOdds, setYesOdds] = useState<number>(defaultYesOdds ?? ODDS_MIN);
  // Per (coin, side) ticket count — capacities differ between YES and NO.
  const [ticketsByKey, setTicketsByKey] = useState<Record<string, number>>({});

  const isYes = side === "yes";

  const summary = useBetSummary(pariId, priceCoinsOptions);
  const coins = useMemo<CoinCapacity[]>(() => buildCoinOptions(summary.data), [summary.data]);

  const source = useMemo<string | null>(
    () => pickSource(coins, requestedSource),
    [coins, requestedSource],
  );

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

  // ─── Limits (before quote — effective ticket counts depend on caps) ───────
  const minTickets = 1;
  const maxTickets = useMemo(
    () =>
      getMaxTickets({
        selectedCoin,
        mode,
        yesOdds,
        isYes,
        affordableInWallet,
        isBookEmpty,
        oddsState: summary.data?.oddsState,
      }),
    [selectedCoin, mode, yesOdds, isYes, affordableInWallet, isBookEmpty, summary.data],
  );

  const effectiveTickets = useMemo(() => {
    if (tickets <= 0 || maxTickets <= 0) return 0;
    return clampTicketCount(tickets, maxTickets);
  }, [tickets, maxTickets]);

  const ticketsOverCap = maxTickets > 0 && tickets > maxTickets;

  // ─── Quote ────────────────────────────────────────────────────────────────
  const quoteParams = useMemo(() => {
    if (!summary.data || !selectedCoin || effectiveTickets <= 0 || !pariId) return null;
    const common = {
      pariId,
      isYes,
      source: selectedCoin.source.address,
      pricedCoins: summary.data.pricedCoins,
    };
    if (mode === "market") {
      if (isBookEmpty) {
        const median = sameSideMedianYesOdds(summary.data.oddsState, isYes);
        return {
          mode: "limit" as const,
          ...common,
          worstYesOdds: median ?? ODDS_MID,
          ticketsCount: effectiveTickets,
          oddsState: summary.data.oddsState,
        };
      }
      return {
        mode: "market" as const,
        ...common,
        marketTickets: effectiveTickets,
        oddsState: summary.data.oddsState,
      };
    }
    if (mode === "limit") {
      return {
        mode: "limit" as const,
        ...common,
        worstYesOdds: yesOdds,
        ticketsCount: effectiveTickets,
        oddsState: summary.data.oddsState,
      };
    }
    return {
      mode: "fixed" as const,
      ...common,
      yesOdds,
      ticketsCount: effectiveTickets,
      oddsState: summary.data.oddsState,
    };
  }, [
    summary.data,
    selectedCoin,
    effectiveTickets,
    pariId,
    isYes,
    mode,
    yesOdds,
    isBookEmpty,
  ]);

  const underlyingQuote = useBetQuote(quoteParams, { staleTime: quoteStaleTime });

  const quote = useMemo<NormalizedQuote>(
    () => normalizeQuote({ underlyingQuote, selectedCoin, yesOdds, isYes, referralPct }),
    [underlyingQuote, selectedCoin, yesOdds, isYes, referralPct],
  );

  // ─── Limits (exported caps — see block above quote) ─────────────────────
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
      value: [Math.min(Math.max(effectiveTickets, 1), Math.max(1, maxTickets))],
      min: 1,
      max: Math.max(1, maxTickets),
      step: 1,
      disabled: maxTickets <= 0,
      onValueChange: (v) => {
        if (v[0] !== undefined) setTickets(clampTicketCount(v[0], maxTickets));
      },
    }),
    [effectiveTickets, maxTickets, setTickets],
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
      value: effectiveTickets,
      canIncrement: effectiveTickets < cap,
      canDecrement: effectiveTickets > 1,
      increment: () => setTickets(clampTicketCount(effectiveTickets + 1, maxTickets)),
      decrement: () => setTickets(Math.max(1, effectiveTickets - 1)),
    };
  }, [effectiveTickets, maxTickets, setTickets]);

  const liquidityMarkers = useMemo(
    () => getLiquidityMarkers(summary.data, isYes),
    [summary.data, isYes],
  );

  // ─── Actions ─────────────────────────────────────────────────────────────
  const confirm = useConfirmBet();
  const qc = useQueryClient();
  const confirmCurrent = useCallback(
    async (ack: { financialRiskAcknowledged: true }): Promise<ConfirmedQuote | null> => {
      if (!quote.data || !quoteParams) return null;
      // Pass `quoteParams` explicitly: the SDK normally tracks them via a
      // WeakMap on the quote object, but that can be lost across HMR / SDK
      // client re-instantiation. Forwarding the live params makes confirm
      // robust against stale tracking.
      return confirm.mutateAsync({
        quote: quote.data,
        params: { ...quoteParams, financialRiskAcknowledged: ack.financialRiskAcknowledged },
      });
    },
    [quote.data, quoteParams, confirm],
  );

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
    effectiveTickets,
    ticketsOverCap,
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
