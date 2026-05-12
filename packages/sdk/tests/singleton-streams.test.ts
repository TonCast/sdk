import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastClient } from "../src";

// Stub fetch so streams don't try real HTTP.
function stubFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/v1/paris/")) {
      // Single-pari endpoints — also serves /odds-state, /coefficient-history
      if (url.includes("/odds-state")) {
        return jsonResponse({ oddsState: { Yes: Array(49).fill(0), No: Array(49).fill(0) } });
      }
      if (url.includes("/coefficient-history")) {
        return jsonResponse({ pariAddress: "EQX", history: [] });
      }
      return jsonResponse(makePari("EQX"));
    }
    if (url.includes("/v1/paris")) {
      return jsonResponse({
        data: [makePari("EQX")],
        pagination: { hasMore: false, nextCursor: null },
      });
    }
    return jsonResponse({});
  });
}

function makePari(id: string) {
  return {
    id,
    name: "n",
    description: "d",
    endTime: 1,
    image: "i",
    yesVolume: 0,
    noVolume: 0,
    status: "active",
    result: "pending",
    createdAt: 1,
    isVisible: true,
    bestYesOdds: null,
    bestNoOdds: null,
    version: null,
    availableBets: null,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function streamPoolSizes(client: ToncastClient): { lists: number; paris: number } {
  const paris = client.paris as unknown as {
    listStreams: Map<string, unknown>;
    pariStreams: Map<string, unknown>;
  };
  return { lists: paris.listStreams.size, paris: paris.pariStreams.size };
}

describe("Pooled streams in ParisResource", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("streamList: same params return the SAME stream (idempotent for StrictMode etc.)", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const a = client.paris.streamList({ feed: "active" });
    const b = client.paris.streamList({ feed: "active" });
    expect(a).toBe(b);
    expect(a.getStatus()).not.toBe("stopped");
    a.stop();
  });

  it("streamList: different params live side-by-side (pool, not singleton)", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const a = client.paris.streamList({ feed: "active" });
    const b = client.paris.streamList({ feed: "finished" });
    await new Promise((r) => setTimeout(r, 0));

    expect(a).not.toBe(b);
    expect(a.getStatus()).not.toBe("stopped");
    expect(b.getStatus()).not.toBe("stopped");

    // Switching back to the original params returns the same warm stream.
    const a2 = client.paris.streamList({ feed: "active" });
    expect(a2).toBe(a);

    a.stop();
    b.stop();
  });

  it("subscribe: same pariId + params return the SAME stream (idempotent)", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const a = client.paris.subscribe("EQA");
    const b = client.paris.subscribe("EQA");
    expect(a).toBe(b);
    expect(a.getStatus()).not.toBe("stopped");
    a.stop();
  });

  it("subscribe: different pariId creates an independent pooled stream", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const a = client.paris.subscribe("EQA");
    const b = client.paris.subscribe("EQB");
    await new Promise((r) => setTimeout(r, 0));

    expect(a).not.toBe(b);
    expect(a.getStatus()).not.toBe("stopped");
    expect(b.getStatus()).not.toBe("stopped");

    a.stop();
    b.stop();
  });

  it("streamList and subscribe are independent (both can be active)", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const list = client.paris.streamList();
    const single = client.paris.subscribe("EQA");

    await new Promise((r) => setTimeout(r, 0));

    expect(list.getStatus()).not.toBe("stopped");
    expect(single.getStatus()).not.toBe("stopped");

    list.stop();
    single.stop();
  });

  it("streamList: a stopped stream is evicted; next call creates a fresh one", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const a = client.paris.streamList();
    expect(streamPoolSizes(client).lists).toBe(1);
    a.stop();
    expect(streamPoolSizes(client).lists).toBe(0);
    const b = client.paris.streamList();
    expect(a).not.toBe(b);
    b.stop();
  });

  it("subscribe: a stopped stream is evicted from the per-pari pool", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const a = client.paris.subscribe("EQA");
    expect(streamPoolSizes(client).paris).toBe(1);
    a.stop();
    expect(streamPoolSizes(client).paris).toBe(0);
    const b = client.paris.subscribe("EQA");
    expect(a).not.toBe(b);
    b.stop();
  });

  it("streamList: subscribe()/unsubscribe() stops the stream after the idle timeout", async () => {
    vi.useFakeTimers();
    stubFetch();
    const client = new ToncastClient({ prefetch: false, streamIdleTimeoutMs: 100 });
    const a = client.paris.streamList();

    const sub = a.subscribe({});
    sub.unsubscribe();
    vi.advanceTimersByTime(99);
    expect(a.getStatus()).not.toBe("stopped");
    vi.advanceTimersByTime(1);
    expect(a.getStatus()).toBe("stopped");
    expect(streamPoolSizes(client).lists).toBe(0);

    // Re-subscribing after idle stop creates a fresh instance.
    const again = client.paris.streamList();
    expect(again).not.toBe(a);

    vi.useRealTimers();
    again.stop();
  });

  it("dispose stops pooled list and per-pari streams immediately", async () => {
    stubFetch();
    const client = new ToncastClient({ prefetch: false });
    const list = client.paris.streamList();
    const single = client.paris.subscribe("EQA");
    await new Promise((r) => setTimeout(r, 0));

    client.dispose();

    expect(list.getStatus()).toBe("stopped");
    expect(single.getStatus()).toBe("stopped");
  });
});
