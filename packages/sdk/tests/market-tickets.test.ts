import {
  ODDS_COUNT,
  ODDS_MAX,
  ODDS_MIN,
  ODDS_STEP,
  PARI_EXECUTION_FEE,
  ticketCost,
  yesOddsToIndex,
} from "@toncast/tx-sdk";
import { describe, expect, it } from "vitest";
import { ToncastClient } from "../src";
import type { OddsState } from "../src/types/odds-state";

/** Build a 49-bucket OddsState with `available` tickets at each
 * (yesOdds, take=NO offers). Keeps tests focused on the indexing
 * convention without dragging real on-chain shape into every assertion. */
function makeOddsState(noOffersAtYesOdds: Record<number, number>): OddsState {
  const Yes = new Array<number>(ODDS_COUNT).fill(0);
  const No = new Array<number>(ODDS_COUNT).fill(0);
  for (const [yesOddsRaw, count] of Object.entries(noOffersAtYesOdds)) {
    const yesOdds = Number(yesOddsRaw);
    // YES bet at yesOdds=X matches NO offers stored at No[idx(100 - X)].
    const idx = yesOddsToIndex(100 - yesOdds);
    No[idx] = count;
  }
  return { Yes, No };
}

describe("BettingResource market-tickets path", () => {
  it("marketCapacity walks YES side cheapest-first and totals correctly", async () => {
    const client = new ToncastClient({ prefetch: false });
    const oddsState = makeOddsState({ 44: 11, 46: 47, 48: 12 });
    const cap = await client.betting.marketCapacity(oddsState, true);
    expect(cap.maxTickets).toBe(11 + 47 + 12);
    expect(cap.affordableTickets).toBe(cap.maxTickets); // no budget passed
    expect(cap.legs).toEqual([
      { yesOdds: 44, available: 11, ticketCostTon: ticketCost(44, true) },
      { yesOdds: 46, available: 47, ticketCostTon: ticketCost(46, true) },
      { yesOdds: 48, available: 12, ticketCostTon: ticketCost(48, true) },
    ]);
  });

  it("marketCapacity with maxBudgetTon clips affordableTickets to matched-only when budget is short", async () => {
    const client = new ToncastClient({ prefetch: false });
    const oddsState = makeOddsState({ 44: 11, 46: 47, 48: 12 });
    // Budget enough for ~5 tickets at @44: 5 * 0.044 + 0.1 fee = 0.32 TON.
    const budget = 5n * ticketCost(44, true) + PARI_EXECUTION_FEE;
    const cap = await client.betting.marketCapacity(oddsState, true, {
      maxBudgetTon: budget,
    });
    expect(cap.maxTickets).toBe(70); // book unchanged
    expect(cap.affordableTickets).toBe(5); // budget covers 5 matched
  });

  it("marketCapacity counts placement overflow when budget exceeds book depth", async () => {
    const client = new ToncastClient({ prefetch: false });
    const oddsState = makeOddsState({ 44: 11 });
    // Cost to match ALL 11 @ 44%: 11 * 0.044 + 0.1 fee = 0.584 TON.
    // Leave 0.022 TON leftover — exactly 0.5 tickets worth at @44 → 0 placement.
    // Bump leftover to 0.044 TON → exactly 1 placement ticket.
    const matchedCost = 11n * ticketCost(44, true) + PARI_EXECUTION_FEE;
    const budget = matchedCost + ticketCost(44, true); // +1 placement
    const cap = await client.betting.marketCapacity(oddsState, true, {
      maxBudgetTon: budget,
    });
    expect(cap.maxTickets).toBe(11); // book unchanged
    expect(cap.affordableTickets).toBe(12); // 11 matched + 1 placement
  });

  it("marketCapacity walks NO side from ODDS_MAX downward", async () => {
    const client = new ToncastClient({ prefetch: false });
    // For NO bet, NO ticketCost goes (100 - yesOdds)/100 — cheapest at high
    // yesOdds. We seed YES offers at the same yesOdds the NO bet would
    // match against (Yes[idx(yesOdds)]).
    const Yes = new Array<number>(ODDS_COUNT).fill(0);
    const No = new Array<number>(ODDS_COUNT).fill(0);
    Yes[yesOddsToIndex(56)] = 5;
    Yes[yesOddsToIndex(54)] = 9;
    const cap = await client.betting.marketCapacity({ Yes, No }, false);
    // Walking from ODDS_MAX=98 down: 56 has 5 offers, 54 has 9.
    expect(cap.maxTickets).toBe(14);
    expect(cap.legs[0]?.yesOdds).toBe(56);
    expect(cap.legs[1]?.yesOdds).toBe(54);
  });

  it("marketCapacity returns empty when no liquidity on the chosen side", async () => {
    const client = new ToncastClient({ prefetch: false });
    const oddsState = makeOddsState({});
    const cap = await client.betting.marketCapacity(oddsState, true);
    expect(cap.maxTickets).toBe(0);
    expect(cap.affordableTickets).toBe(0);
    expect(cap.legs).toEqual([]);
  });

  it("ODDS_STEP / ODDS_MIN / ODDS_MAX cover the full ladder", () => {
    // Sanity: expected 49 buckets at 2-step granularity.
    const buckets: number[] = [];
    for (let o = ODDS_MIN; o <= ODDS_MAX; o += ODDS_STEP) buckets.push(o);
    expect(buckets.length).toBe(ODDS_COUNT);
  });

  it("PARI_EXECUTION_FEE is per-entry and applied alongside ticket cost", () => {
    // Implicit invariant we rely on in `budgetForFirstNTickets`.
    expect(PARI_EXECUTION_FEE > 0n).toBe(true);
    expect(ticketCost(44, true) > 0n).toBe(true);
  });

  it("quoteMarketBet rejects non-positive marketTickets before any network call", async () => {
    // No tonClient deliberately — validation must fire BEFORE we'd touch
    // priceCoins / RPC. If validation moved later in the future, this test
    // would start failing with a different error message instead of
    // silently passing a bogus quote downstream.
    const client = new ToncastClient({ prefetch: false });
    const oddsState = makeOddsState({ 44: 11 });
    await expect(
      client.betting.quoteMarketBet({
        pariId: "EQX",
        isYes: true,
        source: "TON",
        marketTickets: 0,
        oddsState,
      }),
    ).rejects.toThrow(/marketTickets/);
    await expect(
      client.betting.quoteMarketBet({
        pariId: "EQX",
        isYes: true,
        source: "TON",
        marketTickets: 1.5,
        oddsState,
      }),
    ).rejects.toThrow(/marketTickets/);
  });
});
