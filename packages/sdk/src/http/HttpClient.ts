import type { z } from "zod";
import type { Logger } from "../client/config";
import { ToncastApiError, ToncastValidationError } from "../errors";
import type { SupportedLanguage } from "../i18n/languages";
import { withRetry } from "../utils/retry";

export interface HttpClientOptions {
  baseUrl: string;
  /** Resolves the current Accept-Language value at request time. */
  getLanguage: () => SupportedLanguage;
  logger: Logger;
  /** Total HTTP attempts (1 initial + N-1 retries). Default 3. */
  maxAttempts: number;
  /** Base retry delay in ms (doubled per attempt). Default 1000. */
  retryDelayMs: number;
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
  constructor(private readonly opts: HttpClientOptions) {}

  async request<T>(req: RequestOptions<T>): Promise<T> {
    const url = this.buildUrl(req.path, req.query);
    const hasBody = req.body !== undefined;
    const init: RequestInit = {
      method: req.method ?? "GET",
      headers: this.buildHeaders(hasBody),
      signal: req.signal,
    };
    if (hasBody) {
      init.body = JSON.stringify(req.body);
    }

    return withRetry(
      async () => {
        const res = await fetch(url, init);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let detail = text;
          try {
            const parsed = JSON.parse(text) as { error?: unknown };
            if (typeof parsed?.error === "string") detail = parsed.error;
          } catch {
            // body wasn't JSON — keep raw text
          }
          throw new ToncastApiError(
            `HTTP ${res.status} ${res.statusText}: ${detail}`,
            res.status,
            req.path,
          );
        }
        const data = (await res.json()) as unknown;
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
      { maxAttempts: this.opts.maxAttempts, delayMs: this.opts.retryDelayMs },
    );
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
