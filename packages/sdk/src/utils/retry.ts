import { ToncastApiError } from "../errors";

export interface RetryOptions {
  /** Total attempts INCLUDING the first one. Default 3 (1 initial + 2 retries). */
  maxAttempts?: number;
  /** Base delay between retries in ms. Default 1000. Doubled on each attempt (exp backoff). */
  delayMs?: number;
  /** Multiplier on top of `delayMs` when the previous failure was 429 / 5xx. Default 3. */
  rateLimitBackoffMultiplier?: number;
}

/**
 * Smart retry: retries every error by default, but applies a longer back-off
 * when the previous failure looks like rate-limiting (HTTP 429) or a server
 * problem (HTTP 5xx). Network/4xx errors get the standard exponential delay.
 *
 * Honours `Retry-After` semantics indirectly via the multiplier — the backend
 * doesn't currently echo the header, but the multiplier gives it room to recover.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { delayMs = 1000, rateLimitBackoffMultiplier = 3 } = opts;
  // Defensive floor: a `maxAttempts: 0` (or negative) would make the loop a no-op
  // and we'd `throw undefined` with a meaningless stack. Force at least one try.
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // AbortError means the caller cancelled the request intentionally (e.g. component
      // unmount). Retrying would fire more requests that also get aborted — bail immediately.
      if (err instanceof Error && err.name === "AbortError") break;
      if (attempt === maxAttempts - 1) break;

      const baseDelay = delayMs * 2 ** attempt;
      const isThrottle =
        err instanceof ToncastApiError && (err.status === 429 || err.status >= 500);
      const wait = isThrottle ? baseDelay * rateLimitBackoffMultiplier : baseDelay;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
