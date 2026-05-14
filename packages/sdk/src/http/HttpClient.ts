import type { z } from "zod";
import type { Logger } from "../client/config";
import { ToncastApiError, ToncastRateLimitError, ToncastValidationError } from "../errors";
import type { SupportedLanguage } from "../i18n/languages";
import { withRetry } from "../utils/retry";
import { FetchHttpTransport, type HttpTransport } from "./transport";

export interface HttpClientOptions {
  baseUrl: string;
  /** Resolves the current Accept-Language value at request time. */
  getLanguage: () => SupportedLanguage;
  logger: Logger;
  /** Total HTTP attempts (1 initial + N-1 retries). Default 3. */
  maxAttempts: number;
  /** Base retry delay in ms (doubled per attempt). Default 1000. */
  retryDelayMs: number;
  /** Per-request timeout in ms. Set 0 to disable. */
  requestTimeoutMs: number;
  /** Advanced override for tests, tracing, SSR adapters, or custom fetch policies. */
  transport?: HttpTransport;
}

export interface RequestOptions<T> {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  /** Object/array values are JSON-encoded; primitives are stringified as-is. */
  query?: Record<string, string | number | boolean | object | undefined | null>;
  body?: unknown;
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

/** Minimal fetch wrapper with retry, optional zod validation, and Toncast-aware error mapping. */
export class HttpClient {
  private readonly transport: HttpTransport;

  constructor(private readonly opts: HttpClientOptions) {
    this.transport = opts.transport ?? new FetchHttpTransport();
  }

  async request<T>(req: RequestOptions<T>): Promise<T> {
    const url = this.buildUrl(req.path, req.query);
    const hasBody = req.body !== undefined;
    const timeout = createTimeoutSignal(req.signal, this.opts.requestTimeoutMs);
    try {
      const init: RequestInit = {
        method: req.method ?? "GET",
        headers: this.buildHeaders(hasBody),
        signal: timeout.signal,
      };
      if (hasBody) {
        init.body = JSON.stringify(req.body);
      }

      return await withRetry(
        async () => {
          const res = await this.transport.request({
            method: (req.method ?? "GET") as "GET" | "POST" | "PUT" | "DELETE",
            url,
            headers: init.headers as Record<string, string>,
            body: req.body,
            signal: timeout.signal,
          });
          if (res.status < 200 || res.status >= 300) {
            const detail = extractErrorDetail(res.body);
            const message = `HTTP ${res.status} ${res.statusText ?? ""}: ${detail}`;
            const requestId = getHeader(res.headers, "x-request-id");
            if (res.status === 429) {
              throw new ToncastRateLimitError(
                message,
                req.path,
                parseRetryAfterMs(res.headers),
                requestId,
              );
            }
            throw new ToncastApiError(message, res.status, req.path, { requestId });
          }
          const data = res.body;
          if (!req.schema) return data as T;
          const parsed = req.schema.safeParse(data);
          if (!parsed.success) {
            throw new ToncastValidationError(
              `Response validation failed for ${req.path}`,
              parsed.error,
            );
          }
          return parsed.data;
        },
        {
          maxAttempts: this.opts.maxAttempts,
          delayMs: this.opts.retryDelayMs,
          signal: timeout.signal,
        },
      );
    } finally {
      timeout.cleanup();
    }
  }

  private buildUrl(path: string, query?: RequestOptions<unknown>["query"]): string {
    const base = this.opts.baseUrl.replace(/\/+$/, "");
    const tail = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${base}${tail}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        const encoded = typeof v === "object" ? JSON.stringify(v) : String(v);
        url.searchParams.set(k, encoded);
      }
    }
    return url.toString();
  }

  // All Toncast endpoints are currently public — no auth header is sent.
  // If/when auth is introduced, add it here (likely via a `getAuthHeader`
  // option to keep the SDK transport-agnostic).
  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "accept-language": this.opts.getLanguage(),
    };
    // content-type is only meaningful on requests that carry a body.
    // Sending it on GET/DELETE confuses some proxies and CDNs.
    if (hasBody) headers["content-type"] = "application/json";
    return headers;
  }
}

function extractErrorDetail(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return body == null ? "" : JSON.stringify(body);
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

function parseRetryAfterMs(headers: Record<string, string>): number | undefined {
  const raw = getHeader(headers, "retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function createTimeoutSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): { signal?: AbortSignal; cleanup: () => void } {
  if (!parent && timeoutMs <= 0) return { signal: undefined, cleanup: () => {} };
  const controller = new AbortController();
  let done = false;

  const abortFromParent = () => {
    if (done) return;
    controller.abort(parent?.reason);
  };
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          if (!done) controller.abort(new DOMException("Request timed out", "TimeoutError"));
        }, timeoutMs)
      : null;

  return {
    signal: controller.signal,
    cleanup: () => {
      done = true;
      if (timer) clearTimeout(timer);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}
