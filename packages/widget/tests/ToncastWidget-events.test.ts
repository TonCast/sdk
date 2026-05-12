import { describe, expect, it, vi } from "vitest";
import { ToncastWidget } from "../src/ToncastWidget";
import type { ToncastWidgetConfig, ToncastWidgetEventMap } from "../src/types";

const baseConfig: ToncastWidgetConfig = {
  tonconnect: { type: "standalone", options: { domain: "https://example.com" } },
};

/** Test subclass to access the otherwise-private `emit`. */
class TestableWidget extends ToncastWidget {
  testEmit<K extends keyof ToncastWidgetEventMap>(
    event: K,
    payload: ToncastWidgetEventMap[K],
  ): void {
    // biome-ignore lint/suspicious/noExplicitAny: tests intentionally cross access boundary
    (this as any).emit(event, payload);
  }
}

describe("ToncastWidget events: on / off / emit", () => {
  it("on() registers a listener that fires on emit()", () => {
    const w = new TestableWidget(baseConfig);
    const handler = vi.fn();
    w.on("bet", handler);
    w.testEmit("bet", { pariId: "P1", amount: 1n, side: "yes" });
    expect(handler).toHaveBeenCalledWith({ pariId: "P1", amount: 1n, side: "yes" });
  });

  it("off() removes a previously-registered listener", () => {
    const w = new TestableWidget(baseConfig);
    const handler = vi.fn();
    w.on("bet", handler);
    w.off("bet", handler);
    w.testEmit("bet", { pariId: "P", amount: 0n, side: "no" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("multiple listeners all receive the event", () => {
    const w = new TestableWidget(baseConfig);
    const a = vi.fn();
    const b = vi.fn();
    w.on("bet", a);
    w.on("bet", b);
    w.testEmit("bet", { pariId: "P", amount: 0n, side: "yes" });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("a throwing listener triggers the `error` event (no recursion)", () => {
    const w = new TestableWidget(baseConfig);
    const errSpy = vi.fn();
    w.on("error", errSpy);
    w.on("bet", () => {
      throw new Error("kaboom");
    });
    w.testEmit("bet", { pariId: "P", amount: 0n, side: "yes" });
    expect(errSpy).toHaveBeenCalledTimes(1);
    const arg = errSpy.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("kaboom");
  });

  it("a throwing error-listener is logged to console (no recursion)", () => {
    const w = new TestableWidget(baseConfig);
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    w.on("error", () => {
      throw new Error("error-handler-failed");
    });
    w.testEmit("error", new Error("trigger"));
    // 1 console.error call (the inner handler-throw); no infinite loop / stack overflow
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});
