import { describe, expect, it } from "vitest";
import { ToncastClient } from "../src";
import { MAX_UINT32_TICKETS } from "../src/betting/validateTicketsCount";

describe("ticket count pre-validation", () => {
  const client = new ToncastClient({ prefetch: false });

  it("rejects non-integer fixed ticketsCount before tx-sdk", async () => {
    await expect(
      client.betting.quoteFixedBet({
        pariId: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        isYes: true,
        source: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        yesOdds: 50,
        ticketsCount: 1.5,
        pricedCoins: [],
        allowInsufficientBalance: true,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TICKETS_COUNT" });
  });

  it("rejects uint32 overflow on limit ticketsCount", async () => {
    await expect(
      client.betting.quoteLimitBet({
        pariId: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        isYes: true,
        source: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        worstYesOdds: 50,
        ticketsCount: MAX_UINT32_TICKETS + 1,
        oddsState: { Yes: new Array(49).fill(0), No: new Array(49).fill(0) },
        pricedCoins: [],
        allowInsufficientBalance: true,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TICKETS_COUNT" });
  });

  it("rejects invalid marketTickets with stable SDK code", async () => {
    await expect(
      client.betting.quoteMarketBet({
        pariId: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        isYes: true,
        source: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        marketTickets: 0,
        oddsState: { Yes: new Array(49).fill(0), No: new Array(49).fill(0) },
        pricedCoins: [],
        allowInsufficientBalance: true,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TICKETS_COUNT" });
  });
});
