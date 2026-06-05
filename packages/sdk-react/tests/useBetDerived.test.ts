import { type BetSummary, type CoinCapacity, TON_ADDRESS } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import {
  BOOK_EXPLORATION_BUDGET_NANOTON,
  buildCoinOptions,
  getBookExplorationMaxTickets,
  getWalletMaxTickets,
  pickSource,
} from "../src/hooks/useBetDerived";

function capacity(address: string, feasible: boolean): CoinCapacity {
  return {
    source: {
      address,
      amount: 1_000n,
      symbol: address === TON_ADDRESS ? "TON" : "JET",
      decimals: 9,
    },
    feasible,
    reason: feasible ? undefined : "insufficient_balance",
    minBetTon: 1n,
    maxBetTon: feasible ? 100n : 0n,
  };
}

describe("useBet derived helpers", () => {
  it("surfaces loading jettons as non-feasible coin options without polluting priced coins", () => {
    const ton = capacity(TON_ADDRESS, true);
    const summary = {
      capacities: [ton],
      loadingCoins: [{ address: "JETTON", amount: 5_000n, symbol: "JET", decimals: 6 }],
    } as unknown as BetSummary;

    expect(buildCoinOptions(summary)).toEqual([
      ton,
      {
        source: { address: "JETTON", amount: 5_000n, symbol: "JET", decimals: 6 },
        feasible: false,
        reason: "pricing_in_progress",
        minBetTon: 0n,
        maxBetTon: 0n,
      },
    ]);
  });

  it("keeps a requested source even when infeasible, otherwise TON then first coin", () => {
    const jetA = capacity("JET_A", true);
    const jetB = capacity("JET_B", true);
    const tonInfeasible = capacity(TON_ADDRESS, false);

    expect(pickSource([capacity(TON_ADDRESS, true), jetA], jetA.source.address)).toBe(
      jetA.source.address,
    );
    expect(pickSource([tonInfeasible, jetA], TON_ADDRESS)).toBe(TON_ADDRESS);
    expect(pickSource([capacity(TON_ADDRESS, true), jetA], "MISSING")).toBe(TON_ADDRESS);
    expect(pickSource([tonInfeasible, jetA, jetB], null)).toBe(TON_ADDRESS);
    expect(pickSource([], "LAST_REQUESTED")).toBe("LAST_REQUESTED");
  });

  it("ui max tickets is the greater of wallet cap and book exploration cap", () => {
    const coin = capacity(TON_ADDRESS, false);
    coin.maxBetTon = 0n;

    const walletCap = getWalletMaxTickets({
      selectedCoin: coin,
      mode: "market",
      yesOdds: 50,
      isYes: true,
      affordableInWallet: 0,
      isBookEmpty: false,
      oddsState: undefined,
    });
    const bookCap = getBookExplorationMaxTickets({
      mode: "market",
      yesOdds: 50,
      isYes: true,
      isBookEmpty: false,
      oddsState: undefined,
      bookAffordableTickets: 42,
    });

    expect(walletCap).toBe(0);
    expect(bookCap).toBe(42);
    expect(Math.max(walletCap, bookCap)).toBe(42);
    expect(BOOK_EXPLORATION_BUDGET_NANOTON).toBeGreaterThan(0n);
  });
});
