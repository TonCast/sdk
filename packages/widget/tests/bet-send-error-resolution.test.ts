import type { BetFlowErrorDescriptor } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { resolveBetSendErrorTranslationKey } from "../src/components/bet/resolveBetSendErrorTranslationKey";

function d(
  partial: Partial<BetFlowErrorDescriptor> & Pick<BetFlowErrorDescriptor, "kind">,
): BetFlowErrorDescriptor {
  return {
    technicalSummary: "x",
    ...partial,
  };
}

describe("resolveBetSendErrorTranslationKey", () => {
  it("maps wallet_user_rejected", () => {
    expect(resolveBetSendErrorTranslationKey(d({ kind: "wallet_user_rejected" }))).toBe(
      "bet.sendError.walletRejected",
    );
  });

  it("maps known toncast codes", () => {
    expect(
      resolveBetSendErrorTranslationKey(d({ kind: "toncast", toncastCode: "SLIPPAGE_DRIFTED" })),
    ).toBe("bet.sendError.toncast.SLIPPAGE_DRIFTED");
  });

  it("falls back to generic toncast string for unknown codes", () => {
    expect(resolveBetSendErrorTranslationKey(d({ kind: "toncast", toncastCode: "NEW_CODE" }))).toBe(
      "bet.sendError.toncast.generic",
    );
  });
});
