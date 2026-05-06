import { describe, expect, it } from "vitest";
import { PariIncomingSchema } from "../src/ws/pari-protocol";

describe("PariIncomingSchema", () => {
  it("parses bet_placed_with_odds (with sequenceId, matchedPairs optional)", () => {
    const parsed = PariIncomingSchema.parse({
      type: "bet_placed_with_odds",
      pariAddress: "EQABC",
      timestamp: 1700000000000,
      sequenceId: 42,
      data: {
        newBets: [
          {
            id: 1,
            userAddress: "UQX",
            userName: null,
            userImage: null,
            yesOdds: 56,
            ticketsCount: 10,
            remainingTickets: 10,
            isYes: true,
            amount: 5_600_000_000,
            createdAt: 1700000000,
          },
        ],
        oddsState: { Yes: Array(49).fill(0), No: Array(49).fill(0) },
      },
    });
    expect(parsed.type).toBe("bet_placed_with_odds");
  });

  it("parses pari_updated", () => {
    const parsed = PariIncomingSchema.parse({
      type: "pari_updated",
      pariAddress: "EQ",
      timestamp: 1,
      sequenceId: 1,
      data: { deltaYesVolume: 5_000_000_000, deltaNoVolume: -1_000_000_000 },
    });
    expect(parsed.type).toBe("pari_updated");
  });

  it("parses pari_result_set", () => {
    const parsed = PariIncomingSchema.parse({
      type: "pari_result_set",
      pariAddress: "EQ",
      timestamp: 1,
      data: { result: "yes", status: "inactive" },
    });
    expect(parsed.type).toBe("pari_result_set");
  });

  it("parses pari_paused", () => {
    const parsed = PariIncomingSchema.parse({
      type: "pari_paused",
      pariAddress: "EQ",
      timestamp: 1,
      data: { status: "paused" },
    });
    expect(parsed.type).toBe("pari_paused");
  });

  it("parses coefficient_changed", () => {
    const parsed = PariIncomingSchema.parse({
      type: "coefficient_changed",
      pariAddress: "EQ",
      timestamp: 1,
      data: { yesCoefficient: 60, txHash: "abc" },
    });
    expect(parsed.type).toBe("coefficient_changed");
  });

  it("accepts comment_added with passthrough data (we ignore it)", () => {
    const parsed = PariIncomingSchema.parse({
      type: "comment_added",
      pariAddress: "EQ",
      timestamp: 1,
      data: { id: 1, comment: "hi", parentId: null, status: "approved" },
    });
    expect(parsed.type).toBe("comment_added");
  });

  it("parses syncStatus (no envelope)", () => {
    const parsed = PariIncomingSchema.parse({
      type: "syncStatus",
      isLatest: false,
      currentSequence: 168,
    });
    expect(parsed.type).toBe("syncStatus");
  });

  it("parses pong", () => {
    const parsed = PariIncomingSchema.parse({ type: "pong" });
    expect(parsed.type).toBe("pong");
  });

  it("rejects unknown types", () => {
    const result = PariIncomingSchema.safeParse({
      type: "bogus",
      pariAddress: "x",
      timestamp: 1,
      data: {},
    });
    expect(result.success).toBe(false);
  });
});
