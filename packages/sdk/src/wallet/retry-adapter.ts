import type { AxiosAdapter, AxiosError, AxiosResponse } from "axios";
import axios from "axios";
import type { Logger } from "../client/config";

/**
 * Wraps an axios adapter with retry-on-429/5xx + exponential backoff. Intended
 * to defend against public-toncenter rate limiting (1 req/sec without an API key)
 * — `confirmQuote` for jetton-funded bets makes ~6+ STON.fi RPC calls in quick
 * succession and reliably trips the limit.
 *
 * Honours `Retry-After` (seconds or HTTP-date) when the server sends one.
 *
 * Note: the @ton/ton TonClient takes an `httpAdapter` parameter that's passed
 * straight to axios. We bake this in by default in `createTonClient`.
 */
export interface RetryAdapterOptions {
  /** Total attempts including the first. Default 5. */
  maxAttempts?: number | undefined;
  /** Base delay between retries in ms (doubled per attempt). Default 1000. */
  baseDelayMs?: number | undefined;
  /** Cap on the per-retry delay (ms). Default 15_000. */
  maxDelayMs?: number | undefined;
  logger?: Logger | undefined;
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function isRetryableError(err: unknown): err is AxiosError {
  if (!axios.isAxiosError(err)) return false;
  if (err.response) return RETRYABLE_STATUSES.has(err.response.status);
  // Network errors (no response) — DNS, ECONNRESET, timeouts — are retried too.
  return err.code !== "ERR_CANCELED";
}

function parseRetryAfter(value: string | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

export function createRetryAdapter(opts: RetryAdapterOptions = {}): AxiosAdapter {
  const { maxAttempts = 5, baseDelayMs = 1000, maxDelayMs = 15_000, logger } = opts;
  // axios v1 stores `defaults.adapter` as an array of adapter NAMES
  // (`['xhr', 'http', 'fetch']`); the function-form is built lazily by
  // `axios.getAdapter`. Resolve once so we don't recurse into ourselves.
  const baseAdapter = axios.getAdapter(axios.defaults.adapter) as AxiosAdapter;

  return async (config) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await baseAdapter(config);
        return res as AxiosResponse;
      } catch (err) {
        lastErr = err;
        const isLast = attempt === maxAttempts - 1;
        if (isLast || !isRetryableError(err)) throw err;

        const status = err.response?.status;
        const retryAfter = parseRetryAfter(err.response?.headers?.["retry-after"]);
        const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
        const delay = retryAfter !== null ? Math.min(maxDelayMs, retryAfter) : exp;

        logger?.debug?.(
          `tonClient retry: ${status ?? "network err"} → wait ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  };
}
