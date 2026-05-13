// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSyncClientFromConfig } from "../src/utils/useSyncClientFromConfig";

/**
 * Verifies that the hook pushes language / referral into the live `ToncastClient`
 * via `setLanguage` / `setReferral` (not by recreating the client).
 *
 * Uses a hand-rolled fake client — exercising the real SDK here would couple
 * these tests to its full constructor surface (`createTonClient`, prefetch, …).
 */

interface FakeClient {
  setLanguage: ReturnType<typeof vi.fn>;
  setReferral: ReturnType<typeof vi.fn>;
}

function makeFakeClient(): FakeClient {
  return { setLanguage: vi.fn(), setReferral: vi.fn() };
}

function Probe({
  client,
  widget,
}: {
  client: FakeClient;
  widget: Parameters<typeof useSyncClientFromConfig>[1];
}) {
  // The hook only needs setLanguage / setReferral — the cast keeps the test
  // free of the full `ToncastClient` surface.
  useSyncClientFromConfig(
    client as unknown as Parameters<typeof useSyncClientFromConfig>[0],
    widget,
  );
  return null;
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(node));
}

function rerender(node: React.ReactNode) {
  act(() => root?.render(node));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

describe("useSyncClientFromConfig", () => {
  it("pushes initial language to the client", () => {
    const c = makeFakeClient();
    mount(<Probe client={c} widget={{ language: "ru" }} />);
    expect(c.setLanguage).toHaveBeenCalledWith("ru");
  });

  it("calls setLanguage again only when the language actually changes", () => {
    const c = makeFakeClient();
    mount(<Probe client={c} widget={{ language: "en" }} />);
    rerender(<Probe client={c} widget={{ language: "en" }} />);
    expect(c.setLanguage).toHaveBeenCalledTimes(1);

    rerender(<Probe client={c} widget={{ language: "ru" }} />);
    expect(c.setLanguage).toHaveBeenCalledTimes(2);
    expect(c.setLanguage).toHaveBeenLastCalledWith("ru");
  });

  it("does not call setLanguage when language is undefined (host wins)", () => {
    const c = makeFakeClient();
    mount(<Probe client={c} widget={{}} />);
    expect(c.setLanguage).not.toHaveBeenCalled();
  });

  it("pushes initial referral and reapplies on change", () => {
    const c = makeFakeClient();
    mount(<Probe client={c} widget={{ referral: { address: "UQ_a", pct: 3 } }} />);
    expect(c.setReferral).toHaveBeenCalledWith({ address: "UQ_a", pct: 3 });

    rerender(<Probe client={c} widget={{ referral: { address: "UQ_b", pct: 5 } }} />);
    expect(c.setReferral).toHaveBeenCalledTimes(2);
    expect(c.setReferral).toHaveBeenLastCalledWith({ address: "UQ_b", pct: 5 });
  });

  it("does not touch referral when neither field is set", () => {
    const c = makeFakeClient();
    mount(<Probe client={c} widget={{}} />);
    rerender(<Probe client={c} widget={{ language: "en" }} />);
    expect(c.setReferral).not.toHaveBeenCalled();
  });
});
