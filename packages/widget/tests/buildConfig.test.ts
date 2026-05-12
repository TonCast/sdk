import { describe, expect, it, vi } from "vitest";
import { composeOnBetBridge } from "../src/ToncastWidget";
import type { ToncastWidgetConfig } from "../src/types";

const baseConfig: ToncastWidgetConfig = {
  tonconnect: { type: "standalone", options: { domain: "https://example.com" } },
};

describe("composeOnBetBridge", () => {
  it("emits to the bridge when the runtime calls onBet", () => {
    const emit = vi.fn();
    const out = composeOnBetBridge(baseConfig, emit);
    out.widget?.onBet?.("P1", 1_000_000_000n, "yes");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ pariId: "P1", amount: 1_000_000_000n, side: "yes" });
  });

  it("forwards to user-provided onBet AND emits to the bridge", () => {
    const userOnBet = vi.fn();
    const emit = vi.fn();
    const out = composeOnBetBridge({ ...baseConfig, widget: { onBet: userOnBet } }, emit);
    out.widget?.onBet?.("P2", 5n, "no");
    expect(emit).toHaveBeenCalledWith({ pariId: "P2", amount: 5n, side: "no" });
    expect(userOnBet).toHaveBeenCalledWith("P2", 5n, "no");
  });

  it("does not mutate the input config", () => {
    const original = { ...baseConfig };
    composeOnBetBridge(baseConfig, vi.fn());
    expect(baseConfig).toEqual(original);
    expect(baseConfig.widget?.onBet).toBeUndefined();
  });

  it("preserves other widget options when wrapping onBet", () => {
    const out = composeOnBetBridge(
      { ...baseConfig, widget: { theme: "dark", language: "en" } },
      vi.fn(),
    );
    expect(out.widget?.theme).toBe("dark");
    expect(out.widget?.language).toBe("en");
    expect(typeof out.widget?.onBet).toBe("function");
  });
});
