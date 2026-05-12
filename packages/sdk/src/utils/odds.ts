import {
  ODDS_MAX,
  ODDS_MIN,
  ODDS_STEP,
  type OddsState,
  PARI_EXECUTION_FEE,
  ticketCost,
} from "@toncast/tx-sdk";

/**
 * Step `yesOdds` toward a "better" or "worse" decimal multiplier for the
 * bettor's chosen side, clamped to `[ODDS_MIN, ODDS_MAX]`.
 *
 * `yesOdds` is the on-chain target probability (2..98, even). For a YES
 * bettor a lower `yesOdds` means a higher payout multiplier; for a NO
 * bettor it is the opposite. UIs that expose +/− buttons (or otherwise
 * speak the user's language of "better" / "worse" odds) should not have
 * to remember which direction is which — call this helper and forget.
 *
 * @param currentYesOdds - The current on-chain yesOdds value.
 * @param isYes          - Side of the bet.
 * @param direction      - `"improve"` raises the decimal multiplier; `"degrade"` lowers it.
 * @param step           - Defaults to `ODDS_STEP` (= 2). Pass a multiple to jump faster.
 */
export function stepOdds(
  currentYesOdds: number,
  isYes: boolean,
  direction: "improve" | "degrade",
  step: number = ODDS_STEP,
): number {
  const sign = (direction === "improve") === isYes ? -1 : 1;
  const next = currentYesOdds + sign * step;
  return Math.min(ODDS_MAX, Math.max(ODDS_MIN, next));
}

/**
 * `true` iff `stepOdds(currentYesOdds, isYes, direction)` would move the
 * value (i.e. it isn't already at the better/worse extreme). Useful to
 * disable +/− buttons.
 */
export function canStepOdds(
  currentYesOdds: number,
  isYes: boolean,
  direction: "improve" | "degrade",
): boolean {
  return stepOdds(currentYesOdds, isYes, direction) !== currentYesOdds;
}

/**
 * Map a `yesOdds` value to a slider position in `[ODDS_MIN, ODDS_MAX]` such
 * that **lower decimal multiplier sits on the left, higher on the right**.
 * For YES bettors the mapping is inverted (lower `yesOdds` → higher payout
 * → right side); for NO it is identity.
 *
 * Pair with {@link sliderPositionToYesOdds} to round-trip through a UI slider.
 */
export function yesOddsToSliderPosition(yesOdds: number, isYes: boolean): number {
  return isYes ? ODDS_MIN + ODDS_MAX - yesOdds : yesOdds;
}

/** Inverse of {@link yesOddsToSliderPosition}. */
export function sliderPositionToYesOdds(sliderValue: number, isYes: boolean): number {
  return isYes ? ODDS_MIN + ODDS_MAX - sliderValue : sliderValue;
}

/**
 * Per-bucket counter-side liquidity from the bettor's perspective.
 *
 * For a YES bet at `yesOdds = Y` the matching counter-side ask sits at
 * `noOdds = 100 − Y`; the SDK normalises that across both sides so callers
 * just iterate over the returned array. Each entry is a `yesOdds` level the
 * bettor can target, with the number of tickets currently waiting on the
 * counter side. Sorted by `yesOdds` ascending (so cheapest-payout first
 * for YES, highest-payout first for NO).
 *
 * Designed for "show liquidity dots / depth markers on the odds slider"
 * UIs without each app re-deriving the index math from `OddsState`.
 */
export function oddsLiquidity(
  oddsState: OddsState,
  isYes: boolean,
): { yesOdds: number; tickets: number }[] {
  const counter = isYes ? oddsState.No : oddsState.Yes;
  const out: { yesOdds: number; tickets: number }[] = [];
  for (let i = 0; i < counter.length; i++) {
    const tickets = counter[i] ?? 0;
    if (tickets <= 0) continue;
    const counterYesOdds = (i + 1) * ODDS_STEP;
    const yesOdds = isYes ? 100 - counterYesOdds : counterYesOdds;
    if (yesOdds < ODDS_MIN || yesOdds > ODDS_MAX) continue;
    out.push({ yesOdds, tickets });
  }
  out.sort((a, b) => a.yesOdds - b.yesOdds);
  return out;
}

/**
 * Full order-book ladder for an `OddsState` snapshot — one entry per
 * `yesOdds` bucket between `ODDS_MIN..ODDS_MAX` (every `ODDS_STEP`).
 *
 * Each row carries depth on **both** sides at the same `yesOdds`:
 *  - `yesDepth` — counter (NO) tickets a YES bettor would match here
 *  - `noDepth`  — counter (YES) tickets a NO bettor would match here
 *  - `yesPayout` / `noPayout` — decimal multipliers for that side
 *
 * Designed for an order-book UI that renders both ladders simultaneously
 * (depth bars, price spine etc.) without re-deriving the index math.
 * Includes empty buckets — filter with
 * `.filter(r => r.yesDepth > 0 || r.noDepth > 0)` if the UI hides them.
 */
export function orderBookLadder(oddsState: OddsState): {
  yesOdds: number;
  yesDepth: number;
  noDepth: number;
  yesPayout: number;
  noPayout: number;
}[] {
  const buckets = oddsState.Yes.length;
  const out: {
    yesOdds: number;
    yesDepth: number;
    noDepth: number;
    yesPayout: number;
    noPayout: number;
  }[] = new Array(buckets);
  for (let i = 0; i < buckets; i++) {
    // Bucket `i` represents yesOdds = (i + 1) * ODDS_STEP. The matching
    // counter NO entry sits at the mirror index `buckets - 1 - i`.
    const yesOdds = (i + 1) * ODDS_STEP;
    const noLookupIdx = buckets - 1 - i;
    out[i] = {
      yesOdds,
      yesDepth: oddsState.No[noLookupIdx] ?? 0,
      noDepth: oddsState.Yes[i] ?? 0,
      yesPayout: 100 / yesOdds,
      noPayout: 100 / (100 - yesOdds),
    };
  }
  return out;
}

/**
 * Median `yesOdds` of existing same-side orders — the price level where
 * other bettors of the chosen side currently sit. Useful as a default
 * seed when the **counter** side is empty (so there's no leg to match
 * against): "land near where the market is" beats a neutral 50 %.
 *
 * Returns `null` when there are no same-side orders either — caller
 * decides on a final fallback (typically the middle of the range).
 */
export function sameSideMedianYesOdds(oddsState: OddsState, isYes: boolean): number | null {
  // For YES bets we walk Yes[] (existing YES orders); for NO bets we walk
  // No[] (existing NO orders). Index i ↔ "their yesOdds" = (i+1)*ODDS_STEP
  // for YES, but for NO orders the array is indexed by noOdds — convert
  // back to yesOdds via `100 − noOdds`.
  const arr = isYes ? oddsState.Yes : oddsState.No;
  const indices: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if ((arr[i] ?? 0) > 0) indices.push(i);
  }
  if (indices.length === 0) return null;
  const medIdx = indices[Math.floor(indices.length / 2)] ?? 0;
  const offset = (medIdx + 1) * ODDS_STEP;
  return isYes ? offset : 100 - offset;
}

/**
 * Maximum whole tickets a fixed-price bet at `yesOdds` can afford given a
 * TON wallet ceiling already adjusted for swap gas / wallet reserve
 * (typically `selectedCap.maxBetTon` from `useBet`).
 *
 * `(maxBetTon − PARI_EXECUTION_FEE) ÷ ticketCost(yesOdds, isYes)`, floored
 * at 0. Use as the hard cap for +/− steppers and free-form ticket inputs
 * in Fixed-mode bet builders.
 */
export function fixedTicketsForBudget(maxBetTon: bigint, yesOdds: number, isYes: boolean): number {
  const perTicket = ticketCost(yesOdds, isYes);
  if (perTicket <= 0n) return 0;
  const room = maxBetTon - PARI_EXECUTION_FEE;
  if (room <= 0n) return 0;
  return Math.max(0, Number(room / perTicket));
}
