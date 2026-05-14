import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastApiError, ToncastRateLimitError } from "../src";
import { HttpClient } from "../src/http/HttpClient";

const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

function httpOpts(overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {}) {
  return {
    baseUrl: "https://example.test/api/v1",
    getLanguage: () => "en" as const,
    logger,
    maxAttempts: 2,
    retryDelayMs: 1,
    requestTimeoutMs: 0,
    ...overrides,
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

  it("maps 429 responses to ToncastRateLimitError with retryAfter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "slow down" }), {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "7", "x-request-id": "req_123" },
      }),
    );

    const http = new HttpClient(httpOpts({ maxAttempts: 1 }));
    await expect(http.request({ path: "/limited" })).rejects.toMatchObject({
      name: "ToncastRateLimitError",
      code: "RATE_LIMIT",
      status: 429,
      endpoint: "/limited",
      retryAfterMs: 7000,
      requestId: "req_123",
    } satisfies Partial<ToncastRateLimitError>);
  });

  it("preserves request id on generic API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "backend failed" }), {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "x-request-id": "req_500" },
      }),
    );

    const http = new HttpClient(httpOpts({ maxAttempts: 1 }));
    await expect(http.request({ path: "/boom" })).rejects.toMatchObject({
      name: "ToncastApiError",
      code: "API_500",
      status: 500,
      endpoint: "/boom",
      requestId: "req_500",
    } satisfies Partial<ToncastApiError>);
  });
});
