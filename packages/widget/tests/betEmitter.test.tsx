// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type BetEmitter, BetEmitterProvider, useEmitBet } from "../src/context";

/**
 * The `bet` event is now wired exclusively through React context:
 * `<Widget onBet={…} />` → BetEmitterProvider → useEmitBet() in BetCard.
 *
 * These tests exercise that context bridge in isolation so the rest of the
 * widget tree (sdk-react, tonconnect) is not pulled into the test runtime.
 */

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount(node: React.ReactNode): void {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(node));
}

function rerender(node: React.ReactNode): void {
  act(() => root?.render(node));
}

function Probe({ onSeen }: { onSeen: (emit: BetEmitter | null) => void }) {
  const emit = useEmitBet();
  onSeen(emit);
  return null;
}

describe("BetEmitterProvider / useEmitBet", () => {
  it("propagates the emit callback to descendants (forwards via stable wrapper)", () => {
    const emit = vi.fn();
    const captured: Array<BetEmitter | null> = [];
    mount(
      <BetEmitterProvider emit={emit}>
        <Probe onSeen={(e) => captured.push(e)} />
      </BetEmitterProvider>,
    );
    const seen = captured[0];
    expect(seen).toBeTypeOf("function");
    seen?.({ pariId: "P1", amount: 1n, side: "yes" });
    expect(emit).toHaveBeenCalledWith({ pariId: "P1", amount: 1n, side: "yes" });
  });

  it("returns null when no emitter is provided", () => {
    const captured: Array<BetEmitter | null> = [];
    mount(
      <BetEmitterProvider>
        <Probe onSeen={(e) => captured.push(e)} />
      </BetEmitterProvider>,
    );
    expect(captured[0]).toBeNull();
  });

  it("returns null when used outside any provider", () => {
    const captured: Array<BetEmitter | null> = [];
    mount(<Probe onSeen={(e) => captured.push(e)} />);
    expect(captured[0]).toBeNull();
  });

  it("keeps context value identity stable across re-renders with inline arrow", () => {
    const captured: Array<BetEmitter | null> = [];
    const probe = <Probe onSeen={(e) => captured.push(e)} />;

    mount(<BetEmitterProvider emit={(p) => p}>{probe}</BetEmitterProvider>);
    rerender(<BetEmitterProvider emit={(p) => p}>{probe}</BetEmitterProvider>);
    rerender(<BetEmitterProvider emit={(p) => p}>{probe}</BetEmitterProvider>);

    const first = captured[0];
    expect(first).not.toBeNull();
    for (const seen of captured) expect(seen).toBe(first);
  });

  it("forwards to the latest emit callback even though the wrapper is stable", () => {
    const a = vi.fn();
    const b = vi.fn();
    const captured: Array<BetEmitter | null> = [];
    const probe = <Probe onSeen={(e) => captured.push(e)} />;

    mount(<BetEmitterProvider emit={a}>{probe}</BetEmitterProvider>);
    captured.at(-1)?.({ pariId: "P", amount: 1n, side: "yes" });
    expect(a).toHaveBeenCalledTimes(1);

    rerender(<BetEmitterProvider emit={b}>{probe}</BetEmitterProvider>);
    captured.at(-1)?.({ pariId: "P", amount: 2n, side: "no" });
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("flips identity (and only then) when host toggles emit between defined and undefined", () => {
    const captured: Array<BetEmitter | null> = [];
    const probe = <Probe onSeen={(e) => captured.push(e)} />;

    mount(<BetEmitterProvider emit={vi.fn()}>{probe}</BetEmitterProvider>);
    rerender(<BetEmitterProvider>{probe}</BetEmitterProvider>);
    rerender(<BetEmitterProvider emit={vi.fn()}>{probe}</BetEmitterProvider>);

    expect(captured[0]).not.toBeNull();
    expect(captured[1]).toBeNull();
    expect(captured[2]).not.toBeNull();
    expect(captured[2]).not.toBe(captured[0]);
  });
});
