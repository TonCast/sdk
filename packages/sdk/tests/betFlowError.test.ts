import { describe, expect, it } from "vitest";
import { classifyBetFlowError, resolveBetSendErrorTranslationKey } from "../src/betFlowError";
import { ToncastError } from "../src/errors";

describe("classifyBetFlowError", () => {
  it("classifies ToncastError as toncast with code", () => {
    const d = classifyBetFlowError(new ToncastError("rate moved", "SLIPPAGE_DRIFTED"));
    expect(d.kind).toBe("toncast");
    expect(d.toncastCode).toBe("SLIPPAGE_DRIFTED");
    expect(d.technicalSummary).toContain("SLIPPAGE_DRIFTED");
    expect(d.technicalSummary).toContain("rate moved");
  });

  it("classifies TonConnect 'Transaction was not sent' as wallet_user_rejected", () => {
    const d = classifyBetFlowError(
      new Error("[TON_CONNECT_SDK_ERROR]\n_TonConnectUIError Transaction was not sent"),
    );
    expect(d.kind).toBe("wallet_user_rejected");
    expect(d.technicalSummary).toContain("Transaction was not sent");
  });

  it("classifies ERR_NETWORK as network", () => {
    const d = classifyBetFlowError(Object.assign(new Error("boom"), { code: "ERR_NETWORK" }));
    expect(d.kind).toBe("network");
  });

  it("classifies Failed to fetch as network", () => {
    expect(classifyBetFlowError(new Error("Failed to fetch")).kind).toBe("network");
  });

  it("classifies generic TonConnect-looking message as wallet_failed", () => {
    const d = classifyBetFlowError(new Error("[TON_CONNECT_SDK_ERROR] something else"));
    expect(d.kind).toBe("wallet_failed");
  });

  it("classifies unknown Error as unknown", () => {
    expect(classifyBetFlowError(new Error("weird")).kind).toBe("unknown");
  });

  it("does not treat bare 'timeout' as network", () => {
    expect(classifyBetFlowError(new Error("session timeout")).kind).toBe("unknown");
  });

  it("treats network-scoped timeout phrases as network", () => {
    expect(classifyBetFlowError(new Error("network timeout exceeded")).kind).toBe("network");
    expect(classifyBetFlowError(new Error("connection timeout")).kind).toBe("network");
  });

  it("does not classify generic 'wallet' wording as wallet_failed", () => {
    expect(classifyBetFlowError(new Error("check your wallet balance")).kind).toBe("unknown");
  });

  it("classifies non-Error primitives as unknown", () => {
    expect(classifyBetFlowError("raw").kind).toBe("unknown");
    expect(classifyBetFlowError("raw").technicalSummary).toBe("raw");
  });
});

describe("resolveBetSendErrorTranslationKey", () => {
  it("returns catalog paths for each kind", () => {
    expect(resolveBetSendErrorTranslationKey({ kind: "network", technicalSummary: "" })).toBe(
      "bet.sendError.network",
    );
    expect(
      resolveBetSendErrorTranslationKey({
        kind: "toncast",
        toncastCode: "SLIPPAGE_DRIFTED",
        technicalSummary: "",
      }),
    ).toBe("bet.sendError.toncast.SLIPPAGE_DRIFTED");
    expect(
      resolveBetSendErrorTranslationKey({
        kind: "toncast",
        toncastCode: "NEW",
        technicalSummary: "",
      }),
    ).toBe("bet.sendError.toncast.generic");
  });
});
