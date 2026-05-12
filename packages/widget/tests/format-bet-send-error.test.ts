import { ToncastError } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { formatBetSendError } from "../src/components/bet/formatBetSendError";

describe("formatBetSendError", () => {
  it("formats ToncastError as `code: message`", () => {
    const err = new ToncastError("rate moved", "SLIPPAGE_DRIFTED");
    expect(formatBetSendError(err)).toBe("SLIPPAGE_DRIFTED: rate moved");
  });

  it("formats Error with string `code` as `code: message`", () => {
    const err = Object.assign(new Error("network down"), { code: "ENETDOWN" });
    expect(formatBetSendError(err)).toBe("ENETDOWN: network down");
  });

  it("formats Error without code as plain message", () => {
    expect(formatBetSendError(new Error("oops"))).toBe("oops");
  });

  it("formats plain object with `message` and `code`", () => {
    expect(formatBetSendError({ code: "X", message: "y" })).toBe("X: y");
  });

  it("formats plain object with only `message`", () => {
    expect(formatBetSendError({ message: "boom" })).toBe("boom");
  });

  it("falls back to String(err) for primitives and null", () => {
    expect(formatBetSendError("raw")).toBe("raw");
    expect(formatBetSendError(42)).toBe("42");
    expect(formatBetSendError(null)).toBe("null");
    expect(formatBetSendError(undefined)).toBe("undefined");
  });

  it("ignores empty `code` / `message` strings on plain objects", () => {
    expect(formatBetSendError({ code: "", message: "" })).toBe("[object Object]");
    expect(formatBetSendError({ message: "x", code: "" })).toBe("x");
  });
});
