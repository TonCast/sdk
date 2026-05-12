import type { SubscribePariParams } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { toncastQueryKeys } from "../src/queryKeys";
import { serializeKey } from "../src/utils/serializeKey";

/**
 * Guards that `toncastQueryKeys` stays aligned with hook `queryKey` shapes.
 * When adding a hook, extend this file so prefetch/invalidate cannot drift.
 */
describe("toncastQueryKeys contract", () => {
  it("paris.detail uses detail segment and _disabled", () => {
    expect([...toncastQueryKeys.paris.detail(undefined)]).toEqual([
      "toncast",
      "paris",
      "detail",
      "_disabled",
    ]);
    expect([...toncastQueryKeys.paris.detail("EQx")]).toEqual([
      "toncast",
      "paris",
      "detail",
      "EQx",
    ]);
  });

  it("paris.list serializes params (BigInt-safe)", () => {
    const params = { cursor: "c1", maxBudgetTon: 10n };
    expect([...toncastQueryKeys.paris.list(params)]).toEqual([
      "toncast",
      "paris",
      "list",
      serializeKey(params),
    ]);
  });

  it("paris.streamList serializes params", () => {
    const params = { feed: "active" as const };
    expect([...toncastQueryKeys.paris.streamList(params)]).toEqual([
      "toncast",
      "paris",
      "streamList",
      serializeKey(params),
    ]);
  });

  it("paris.subscribe serializes params", () => {
    const pariId = "EQpari";
    const params: SubscribePariParams = { coefficientHistory: { timeframe: "ALL", limit: 100 } };
    expect([...toncastQueryKeys.paris.subscribe(pariId, params)]).toEqual([
      "toncast",
      "paris",
      "subscribe",
      pariId,
      serializeKey(params),
    ]);
  });

  it("categories and categoryFilters use language segment", () => {
    expect([...toncastQueryKeys.categories("en")]).toEqual(["toncast", "categories", "en"]);
    expect([...toncastQueryKeys.categoryFilters("ru")]).toEqual([
      "toncast",
      "category-filters",
      "ru",
    ]);
  });

  it("coins.list matches resolved address slot", () => {
    expect([...toncastQueryKeys.coins.list(null)]).toEqual(["toncast", "coins", "list", null]);
    expect([...toncastQueryKeys.coins.list("EQaddr")]).toEqual([
      "toncast",
      "coins",
      "list",
      "EQaddr",
    ]);
  });

  it("betting.marketCapacity serializes opts", () => {
    expect([
      ...toncastQueryKeys.betting.marketCapacity("EQsrc", true, { maxBudgetTon: 3n }),
    ]).toEqual([
      "toncast",
      "betting",
      "marketCapacity",
      "EQsrc",
      true,
      serializeKey({ maxBudgetTon: 3n }),
    ]);
  });

  it("betting.quote serializes params", () => {
    const params = { mode: "market" as const, pariId: "x", maxBudgetTon: 1n };
    expect([...toncastQueryKeys.betting.quote(params)]).toEqual([
      "toncast",
      "betting",
      "quote",
      serializeKey(params),
    ]);
  });

  it("betting.betsInvalidationPrefix matches start of bets and infiniteBets keys", () => {
    const prefix = [...toncastQueryKeys.betting.betsInvalidationPrefix];
    expect(prefix).toEqual(["toncast", "betting", "bets"]);
    const userParams = { userAddress: "EQuser" };
    expect([...toncastQueryKeys.betting.bets(userParams)].slice(0, 3)).toEqual(prefix);
    expect([...toncastQueryKeys.betting.infiniteBets(userParams)].slice(0, 3)).toEqual(prefix);
  });
});
