import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LANGUAGE, resolveLanguage, ToncastClient } from "../src";

describe("resolveLanguage", () => {
  it("returns primary subtag when supported", () => {
    expect(resolveLanguage("ru")).toBe("ru");
    expect(resolveLanguage("ru-RU")).toBe("ru");
    expect(resolveLanguage("zh-Hans-CN")).toBe("zh");
    expect(resolveLanguage("EN_US")).toBe("en");
  });

  it("falls back to default for unsupported tags", () => {
    expect(resolveLanguage("ja")).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage("xx-XX")).toBe(DEFAULT_LANGUAGE);
  });

  it("prefers explicit input over navigator, even when input is unsupported", () => {
    vi.stubGlobal("navigator", { language: "ru-RU", languages: ["ru-RU"] });
    // Browser is Russian, but caller explicitly asked for Japanese (unsupported)
    // → must fall back to DEFAULT_LANGUAGE ("en"), NOT navigator's "ru".
    expect(resolveLanguage("ja")).toBe(DEFAULT_LANGUAGE);
    // Supported explicit input still wins over navigator.
    expect(resolveLanguage("de")).toBe("de");
  });

  it("uses navigator.language when input is empty", () => {
    vi.stubGlobal("navigator", { language: "es-MX", languages: ["es-MX", "en-US"] });
    expect(resolveLanguage(undefined)).toBe("es");
  });

  it("falls back to default when navigator absent", () => {
    vi.stubGlobal("navigator", undefined);
    expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe("ToncastClient language handling", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to en when no option and no navigator", () => {
    const client = new ToncastClient();
    expect(client.getLanguage()).toBe("en");
  });

  it("accepts a language option and normalises it", () => {
    const client = new ToncastClient({ language: "fr-FR" });
    expect(client.getLanguage()).toBe("fr");
  });

  it("falls back to en for unsupported language", () => {
    const client = new ToncastClient({ language: "ja" });
    expect(client.getLanguage()).toBe("en");
  });

  it("swaps language at runtime", () => {
    const client = new ToncastClient();
    client.setLanguage("ar");
    expect(client.getLanguage()).toBe("ar");
    client.setLanguage("xx");
    expect(client.getLanguage()).toBe("en");
  });

  it("sends Accept-Language header in HTTP requests", async () => {
    const okResponse = (): Response =>
      new Response(JSON.stringify({ data: [], pagination: { hasMore: false, nextCursor: null } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => okResponse());
    const client = new ToncastClient({
      baseUrl: "https://example.test",
      language: "de",
      prefetch: false,
    });

    await client.paris.list();
    const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["accept-language"]).toBe("de");

    client.setLanguage("zh-Hans-CN");
    await client.paris.list();
    const headers2 = fetchSpy.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(headers2["accept-language"]).toBe("zh");

    fetchSpy.mockRestore();
  });
});
