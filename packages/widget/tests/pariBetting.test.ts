import type { Pari } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { isBettingClosed } from "../src/utils/pariBetting";

function pari(overrides: Partial<Pari> = {}): Pari {
  return {
    id: "P1",
    name: "Test",
    description: "",
    endTime: 9_999_999_999,
    image: "",
    yesVolume: 0,
    noVolume: 0,
    status: "active",
    result: "pending",
    createdAt: 0,
    isVisible: true,
    bestYesOdds: 50,
    bestNoOdds: 50,
    version: "v2",
    availableBets: null,
    ...overrides,
  };
}

describe("isBettingClosed", () => {
  const now = 1_700_000_000;

  it("is false for an active open market", () => {
    expect(isBettingClosed(pari(), now)).toBe(false);
  });

  it("is true when the outcome is settled", () => {
    expect(isBettingClosed(pari({ result: "yes" }), now)).toBe(true);
    expect(isBettingClosed(pari({ result: "no" }), now)).toBe(true);
    expect(isBettingClosed(pari({ result: "draw" }), now)).toBe(true);
  });

  it("is true when inactive (pending result)", () => {
    expect(isBettingClosed(pari({ status: "inactive", result: "pending" }), now)).toBe(true);
  });

  it("is true when endTime has passed", () => {
    expect(isBettingClosed(pari({ endTime: now }), now)).toBe(true);
    expect(isBettingClosed(pari({ endTime: now - 1 }), now)).toBe(true);
  });
});
