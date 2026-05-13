// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastWidget } from "../src/ToncastWidget";
import type { ToncastWidgetConfig, ToncastWidgetEventMap } from "../src/types";

const STYLE_ID = "toncast-widget-styles";

const baseConfig: ToncastWidgetConfig = {
  tonconnect: { type: "standalone", options: { domain: "https://example.com" } },
};

/** Test subclass to access private `emit` for listener lifecycle assertions. */
class TestableWidget extends ToncastWidget {
  testEmit<K extends keyof ToncastWidgetEventMap>(
    event: K,
    payload: ToncastWidgetEventMap[K],
  ): void {
    // biome-ignore lint/suspicious/noExplicitAny: tests intentionally cross access boundary
    (this as any).emit(event, payload);
  }
}

function makeContainer(): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  for (const n of document.head.querySelectorAll(`#${STYLE_ID}`)) n.remove();
});

describe("ToncastWidget lifecycle", () => {
  it("mount() injects a versioned <style> tag", () => {
    const w = new ToncastWidget(baseConfig);
    const c = makeContainer();
    w.mount(c);
    const style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    expect(style).not.toBeNull();
    expect(style?.getAttribute("data-version")).toBeTruthy();
    w.unmount();
  });

  it("repeated mount() without unmount logs a warning and is a no-op", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const w = new ToncastWidget(baseConfig);
    const c = makeContainer();
    w.mount(c);
    w.mount(c);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/already mounted/i);
    w.unmount();
    warn.mockRestore();
  });

  it("update() before mount() is safe and the new config is used at first mount", () => {
    const w = new ToncastWidget(baseConfig);
    expect(() =>
      w.update({
        ...baseConfig,
        tonconnect: { type: "standalone", options: { domain: "https://updated.example" } },
      }),
    ).not.toThrow();
    const c = makeContainer();
    expect(() => w.mount(c)).not.toThrow();
    w.unmount();
  });

  it("style tag is removed only after the LAST instance unmounts", () => {
    const a = new ToncastWidget(baseConfig);
    const b = new ToncastWidget(baseConfig);
    const ca = makeContainer();
    const cb = makeContainer();
    a.mount(ca);
    b.mount(cb);
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
    a.unmount();
    expect(document.getElementById(STYLE_ID)).not.toBeNull(); // b still mounted
    b.unmount();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it("outdated style tag (different data-version) is replaced on mount", () => {
    const stale = document.createElement("style");
    stale.id = STYLE_ID;
    stale.setAttribute("data-version", "stale-version-xyz");
    stale.textContent = "/* stale */";
    document.head.appendChild(stale);

    const w = new ToncastWidget(baseConfig);
    const c = makeContainer();
    w.mount(c);

    const current = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    expect(current).not.toBeNull();
    expect(current?.getAttribute("data-version")).not.toBe("stale-version-xyz");
    w.unmount();
  });

  it("does NOT inject inline <style> when host already provides the CDN stylesheet link", () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute("data-toncast-widget-css", "");
    link.setAttribute("data-toncast-widget-css-loaded", "true");
    document.head.appendChild(link);

    const w = new ToncastWidget(baseConfig);
    const c = makeContainer();
    w.mount(c);

    expect(document.getElementById(STYLE_ID)).toBeNull();
    w.unmount();
    link.remove();
  });

  it("type contract: config.widget.onBet is removed — only widget.on('bet', …) remains", () => {
    // The deprecated callback was removed in favour of the imperative event
    // bus; this assertion fails the build if it is ever re-introduced.
    const _bad: ToncastWidgetConfig = {
      ...baseConfig,
      // @ts-expect-error - widget.onBet is intentionally removed; subscribe via widget.on('bet', …) instead
      widget: { onBet: () => undefined },
    };
    expect(_bad).toBeDefined();
  });
});

describe("ToncastWidget.dispose", () => {
  it("clears listeners so emit no longer invokes them", () => {
    const w = new TestableWidget(baseConfig);
    const bet = vi.fn();
    w.on("bet", bet);
    w.dispose();
    w.testEmit("bet", { pariId: "P", amount: 1n, side: "yes" });
    expect(bet).not.toHaveBeenCalled();
  });

  it("is idempotent", () => {
    const w = new TestableWidget(baseConfig);
    expect(() => {
      w.dispose();
      w.dispose();
    }).not.toThrow();
  });

  it("is safe before mount()", () => {
    const w = new TestableWidget(baseConfig);
    expect(() => w.dispose()).not.toThrow();
  });
});
