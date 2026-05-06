// Verifies streams transition to `status === "error"` when the initial fetch
// fails (e.g. pari hidden / not found / network down). Without this the streams
// would silently sit in `loading` forever, broadcasts would arrive against a
// null state and be dropped — a UX disaster (#2/#3 from the audit).

import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastClient } from "../src";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("stream error status (initial fetch failure)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("paris.subscribe() transitions to 'error' when get() returns 404", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
    );
    const client = new ToncastClient({ maxAttempts: 1 });
    const stream = client.paris.subscribe("EQHIDDEN");

    const seen: string[] = [];
    stream.onStatus((s) => seen.push(s));
    await new Promise((r) => setTimeout(r, 50));

    expect(stream.getStatus()).toBe("error");
    expect(stream.getError()).toBeInstanceOf(Error);
    expect(seen).toContain("error");
    stream.stop();
  });

  it("paris.subscribe() transitions to 'error' for hidden pari (isVisible:false)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({
        id: "EQHIDDEN",
        name: "n",
        description: "d",
        endTime: 1,
        image: "i",
        yesVolume: 0,
        noVolume: 0,
        status: "active",
        result: "pending",
        createdAt: 1,
        isVisible: false,
        bestYesOdds: null,
        bestNoOdds: null,
        version: null,
        availableBets: null,
      }),
    );
    const client = new ToncastClient({ maxAttempts: 1 });
    const stream = client.paris.subscribe("EQHIDDEN");
    await new Promise((r) => setTimeout(r, 50));

    expect(stream.getStatus()).toBe("error");
    expect(stream.getError()?.message).toMatch(/not found/i);
    stream.stop();
  });

  it("paris.streamList() transitions to 'error' on initial fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );
    const client = new ToncastClient({ maxAttempts: 1 });
    const stream = client.paris.streamList();
    await new Promise((r) => setTimeout(r, 50));

    expect(stream.getStatus()).toBe("error");
    expect(stream.getError()).toBeInstanceOf(Error);
    stream.stop();
  });
});
