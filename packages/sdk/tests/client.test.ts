import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastClient, ToncastError } from "../src";

describe("ToncastClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs without userAddress and exposes resources", () => {
    const client = new ToncastClient();
    expect(client.paris).toBeDefined();
    expect(client.categories).toBeDefined();
    expect(client.bets).toBeDefined();
    expect(client.coins).toBeDefined();
    expect(client.betting).toBeDefined();
    expect(client.getUserAddress()).toBeUndefined();
  });

  it("persists and swaps userAddress", () => {
    const first = "UQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAZAm";
    const second = "UQACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfn";
    const client = new ToncastClient({ userAddress: first });
    expect(client.getUserAddress()).toBe(first);
    client.setUserAddress(second);
    expect(client.getUserAddress()).toBe(second);
    client.clearUserAddress();
    expect(client.getUserAddress()).toBeUndefined();
  });

  it("rejects invalid userAddress values before they enter SDK state", () => {
    expect(() => new ToncastClient({ userAddress: "UQA1" })).toThrow(ToncastError);
    const client = new ToncastClient();
    expect(() => client.setUserAddress("not-an-address")).toThrow(ToncastError);
    expect(client.getUserAddress()).toBeUndefined();
  });

  it("throws USER_ADDRESS_REQUIRED on personal methods when no address set", async () => {
    const client = new ToncastClient();
    await expect(client.bets.listForPariByUser({ pariId: "EQX" })).rejects.toBeInstanceOf(
      ToncastError,
    );
    await expect(client.coins.list()).rejects.toBeInstanceOf(ToncastError);
  });

  it("does not prefetch or hit the network by default", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    new ToncastClient();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prefetches categories only when explicitly requested", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    new ToncastClient({ prefetch: { categories: true } });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://toncast.me/api/v1/categories");
  });
});
