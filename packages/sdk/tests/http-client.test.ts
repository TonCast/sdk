import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/http/HttpClient";

const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

function httpOpts() {
  return {
    baseUrl: "https://example.test/api/v1",
    getLanguage: () => "en" as const,
    logger,
    maxAttempts: 2,
    retryDelayMs: 1,
    requestTimeoutMs: 0,
  };
}

describe("HttpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not retry when the caller aborts the request", async () => {
    const ac = new AbortController();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    });

    const http = new HttpClient(httpOpts());
    const p = http.request({ path: "/paris", signal: ac.signal });
    ac.abort();

    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns JSON body when no schema is provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const http = new HttpClient(httpOpts());
    await expect(http.request({ path: "/x" })).resolves.toEqual({ ok: true });
  });
});
