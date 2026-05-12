import { type BetSummary, type CoinCapacity, TON_ADDRESS } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { buildCoinOptions, pickSource } from "../src/hooks/useBetDerived";

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

  it("keeps a requested feasible source, otherwise falls back to TON then first viable coin", () => {
    const jetA = capacity("JET_A", true);
    const jetB = capacity("JET_B", true);

    expect(pickSource([capacity(TON_ADDRESS, true), jetA], jetA.source.address)).toBe(
      jetA.source.address,
    );
    expect(pickSource([capacity(TON_ADDRESS, true), jetA], "MISSING")).toBe(TON_ADDRESS);
    expect(pickSource([capacity(TON_ADDRESS, false), jetA, jetB], null)).toBe(jetA.source.address);
    expect(pickSource([], "LAST_REQUESTED")).toBe("LAST_REQUESTED");
  });
});
