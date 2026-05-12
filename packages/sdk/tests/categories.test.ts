import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastClient } from "../src";

const SAMPLE_RU = [
  { id: 1, title: "Спорт" },
  { id: 3, title: "Крипто" },
  { id: 4, title: "Культура" },
  { id: 5, title: "Политика" },
  { id: 6, title: "Экономика" },
];

const SAMPLE_EN = [
  { id: 1, title: "Sports" },
  { id: 3, title: "Crypto" },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("categories.list", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits /v1/categories with Accept-Language and parses the array", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse(SAMPLE_RU));
    const client = new ToncastClient({ language: "ru" });
    const categories = await client.categories.list();

    expect(categories).toEqual(SAMPLE_RU);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://toncast.me/api/v1/categories");
    const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["accept-language"]).toBe("ru");
  });

  it("caches forever per language and refetches on language switch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const ru = url.includes("categories");
      return jsonResponse(ru ? SAMPLE_RU : []);
    });
    const client = new ToncastClient({ language: "ru" });

    await client.categories.list();
    await client.categories.list();
    await client.categories.list();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    client.setLanguage("en");
    await client.categories.list();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    client.setLanguage("ru");
    await client.categories.list();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    client.categories.clearCache();
    await client.categories.list();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("dedupes concurrent in-flight requests for the same language", async () => {
    let resolveFetch!: () => void;
    const gate = new Promise<void>((r) => {
      resolveFetch = r;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await gate;
      return jsonResponse(SAMPLE_EN);
    });
    const client = new ToncastClient({ language: "en" });

    const p1 = client.categories.list();
    const p2 = client.categories.list();
    const p3 = client.categories.list();
    resolveFetch();
    const [a, b, c] = await Promise.all([p1, p2, p3]);

    expect(a).toEqual(SAMPLE_EN);
    expect(b).toEqual(SAMPLE_EN);
    expect(c).toEqual(SAMPLE_EN);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("listFilters returns UI-ready feed/category filters separately from raw categories", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse(SAMPLE_EN));
    const client = new ToncastClient({ language: "en", prefetch: false });

    await expect(client.categories.listFilters()).resolves.toEqual([
      { name: "All", param: { feed: "active" } },
      { name: "Sports", param: { feed: "active", categoryId: 1 } },
      { name: "Crypto", param: { feed: "active", categoryId: 3 } },
      { name: "Pending result", param: { feed: "pending" } },
      { name: "Finished", param: { feed: "finished" } },
    ]);
    await expect(client.categories.list()).resolves.toEqual(SAMPLE_EN);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
