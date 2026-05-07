import type { Bet } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { appendBetsPage } from "../src/views/myBetsState";

function bet(id: string): Bet {
  return { id } as Bet;
}

describe("appendBetsPage", () => {
  it("resets to the first page when loading the initial cursor", () => {
    expect(appendBetsPage([bet("old")], [bet("new")], { reset: true, max: 10 })).toEqual([
      bet("new"),
    ]);
  });

  it("caps accumulated pages to avoid unbounded memory growth", () => {
    const previous = Array.from({ length: 3 }, (_, i) => bet(`previous-${i}`));
    const items = Array.from({ length: 3 }, (_, i) => bet(`next-${i}`));

    expect(appendBetsPage(previous, items, { reset: false, max: 4 })).toEqual([
      bet("previous-0"),
      bet("previous-1"),
      bet("previous-2"),
      bet("next-0"),
    ]);
  });
});
