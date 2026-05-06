import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastClient } from "../src";

const SAMPLE = {
  data: [
    {
      id: "EQD8ZQT-g8wisN-vMlrls4Dw_ua3DpAB_zhBzId-YqW1AJw5",
      name: "Будет ли курс ETH выше $2,373.59 25 апреля 2026 года?",
      description: "long…",
      endTime: 1777075199,
      image: "c856dc88-351e-4b4a-52a5-8c9ef4d23e00",
      yesVolume: 15.78,
      noVolume: 19.936,
      status: "active",
      result: "pending",
      createdAt: 1776761532,
      isVisible: true,
      bestYesOdds: 44,
      bestNoOdds: 56,
      version: "v3",
      availableBets: JSON.stringify({
        2: "EQDpxLsKCWj7maDq7qBf5OD7dqLbTnPGufNjltAWlfEUQjAd",
        4: "EQAPEeqOPZWtUcpZ21yRnQLy7HWTzi0GOrYaPONzjK9hlz6k",
        98: "EQDQlzvSkFhQUhPTMezMF_CCMTrcUpFN7ElD0oaz9ean7Vk8",
      }),
    },
  ],
  pagination: { hasMore: false, nextCursor: null },
};

describe("paris.list", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits /v1/paris with categoryId & limit, parses envelope and availableBets", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(SAMPLE), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const client = new ToncastClient({ language: "ru", prefetch: false });
    const page = await client.paris.list({ categoryId: 3, limit: 20 });

    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain("https://toncast.me/api/v1/paris");
    expect(url).toContain("categoryId=3");
    expect(url).toContain("limit=20");

    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);

    const pari = page.items[0];
    if (!pari) throw new Error("no pari");
    expect(pari.id).toBe("EQD8ZQT-g8wisN-vMlrls4Dw_ua3DpAB_zhBzId-YqW1AJw5");
    expect(pari.bestYesOdds).toBe(44);
    const bets = pari.availableBets;
    if (!bets) throw new Error("expected availableBets");
    expect(bets[2]).toBe("EQDpxLsKCWj7maDq7qBf5OD7dqLbTnPGufNjltAWlfEUQjAd");
    expect(bets[98]).toBe("EQDQlzvSkFhQUhPTMezMF_CCMTrcUpFN7ElD0oaz9ean7Vk8");
    expect(Object.keys(bets)).toHaveLength(3);
  });

  it("iterate stops when hasMore is false", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(SAMPLE), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new ToncastClient({ prefetch: false });
    const collected: string[] = [];
    for await (const pari of client.paris.iterate({ limit: 20 })) {
      collected.push(pari.id);
    }
    expect(collected).toHaveLength(1);
  });

  it("includeInactive=true sends the flag and parses object cursor + finished result", async () => {
    const inactiveSample = {
      data: [
        {
          id: "EQAYEAWYh8Swk0jQm9rlerRqrnTvLVJD-Al4YH6mKBdq7RXq",
          name: "Will Brent crude be above $94.40/barrel on April 21, 2026?",
          description: "…",
          endTime: 1776758400,
          image: "17766949918579467",
          yesVolume: 0.458,
          noVolume: 3.68,
          status: "inactive",
          result: "draw",
          createdAt: 1776696519,
          isVisible: true,
          bestYesOdds: 50,
          bestNoOdds: 50,
          version: "v3",
          availableBets: JSON.stringify({ 50: "EQBXRIZl5QNpeOU-qCqs34jIIECssrxIKdU8XZz-1aTrb2kk" }),
        },
      ],
      pagination: {
        hasMore: true,
        nextCursor: {
          sortValue: 1774137540,
          address: "EQDD1Pi4qzhDBnXMD2jWbCkMTnFjgn4p1vywKTqmhEOMMOw4",
        },
      },
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(inactiveSample), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const client = new ToncastClient({ prefetch: false });
    const page = await client.paris.list({ feed: "finished", limit: 20 });

    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain("includeInactive=true");
    expect(url).not.toContain("showPendingResults");
    expect(url).toContain("limit=20");
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toEqual({
      sortValue: 1774137540,
      address: "EQDD1Pi4qzhDBnXMD2jWbCkMTnFjgn4p1vywKTqmhEOMMOw4",
    });
    expect(page.items[0]?.status).toBe("inactive");
    expect(page.items[0]?.result).toBe("draw");
  });

  it("splits cursor into cursorSortValue + cursorAddress query params", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ data: [], pagination: { hasMore: false, nextCursor: null } }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      );
    const client = new ToncastClient({ prefetch: false });
    await client.paris.list({
      feed: "finished",
      cursor: { sortValue: 123, address: "EQABC" },
    });
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get("cursorSortValue")).toBe("123");
    expect(url.searchParams.get("cursorAddress")).toBe("EQABC");
    expect(url.searchParams.get("cursor")).toBeNull();
  });

  it("feed=pending maps to showPendingResults, search passes through", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ data: [], pagination: { hasMore: false, nextCursor: null } }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      );
    const client = new ToncastClient({ prefetch: false });
    await client.paris.list({ feed: "pending", search: "ETH price", limit: 50 });
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get("search")).toBe("ETH price");
    expect(url.searchParams.get("showPendingResults")).toBe("true");
    expect(url.searchParams.get("includeInactive")).toBeNull();
    expect(url.searchParams.get("limit")).toBe("50");
  });

  it("default feed=active sends no feed flags", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ data: [], pagination: { hasMore: false, nextCursor: null } }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      );
    const client = new ToncastClient({ prefetch: false });
    await client.paris.list();
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get("includeInactive")).toBeNull();
    expect(url.searchParams.get("showPendingResults")).toBeNull();
  });

  it("accepts nullable bestYesOdds / bestNoOdds / version / availableBets", async () => {
    const sample = {
      data: [
        {
          id: "EQXYZ",
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
        },
      ],
      pagination: { hasMore: false, nextCursor: null },
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(sample), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new ToncastClient({ prefetch: false });
    const page = await client.paris.list();
    expect(page.items[0]?.bestYesOdds).toBeNull();
    expect(page.items[0]?.bestNoOdds).toBeNull();
    expect(page.items[0]?.version).toBeNull();
    expect(page.items[0]?.availableBets).toBeNull();
  });

  it("hides isVisible:false paris from list() and throws 404 from get()", async () => {
    const mixed = {
      data: [
        { ...SAMPLE.data[0], id: "EQVISIBLE", isVisible: true },
        { ...SAMPLE.data[0], id: "EQHIDDEN", isVisible: false },
      ],
      pagination: { hasMore: false, nextCursor: null },
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/paris/EQHIDDEN")) {
        return new Response(JSON.stringify(mixed.data[1]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(mixed), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new ToncastClient({ prefetch: false });
    const page = await client.paris.list();
    expect(page.items.map((p) => p.id)).toEqual(["EQVISIBLE"]);
    await expect(client.paris.get("EQHIDDEN")).rejects.toMatchObject({
      name: "ToncastApiError",
      status: 404,
    });
  });

  it("propagates `error` field from JSON error responses into ToncastApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Search query too long" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new ToncastClient({ prefetch: false });
    await expect(client.paris.list({ search: "x".repeat(200) })).rejects.toMatchObject({
      name: "ToncastApiError",
      status: 400,
      message: expect.stringContaining("Search query too long"),
    });
  });
});
