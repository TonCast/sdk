import { Client as TonClient } from "@ston-fi/sdk";
import type { Logger } from "../client/config";
import { createRetryAdapter, type RetryAdapterOptions } from "./retry-adapter";

export interface CreateTonClientOptions {
  /** Public RPC endpoint. Defaults to toncenter mainnet (free tier). */
  endpoint?: string | undefined;
  /** Optional API key for the endpoint (e.g. toncenter `X-API-Key`). */
  apiKey?: string | undefined;
  /** Mainnet vs testnet — defaults to "mainnet". */
  network?: "mainnet" | "testnet" | undefined;
  /**
   * Custom axios adapter. By default the client uses a retry-on-429/5xx
   * adapter (5 attempts, exponential backoff, honours `Retry-After`).
   * Pass `null` to disable, or your own adapter to fully replace.
   */
  httpAdapter?: ConstructorParameters<typeof TonClient>[0]["httpAdapter"] | null | undefined;
  /** Override retry adapter behaviour (max attempts, base delay, …). */
  retry?: RetryAdapterOptions | undefined;
  /** Optional logger for retry debug output. */
  logger?: Logger | undefined;
}

/**
 * Convenience factory for the STON.fi-aware `TonClient` accepted by
 * `ToncastClient` and `@toncast/tx-sdk`. Defaults are tuned for quick start;
 * production deployments should pass their own `endpoint` + `apiKey`.
 *
 * **Retry built-in:** the default axios adapter retries 429 / 5xx with
 * exponential backoff, honouring `Retry-After`. Critical for jetton-funded
 * bets — `confirmQuote` makes ~6+ STON.fi RPC calls and hits public toncenter's
 * 1 req/sec limit without it. Override with `httpAdapter: null` to disable
 * (e.g. if you've already wrapped axios upstream).
 */
export function createTonClient(options: CreateTonClientOptions = {}): TonClient {
  const network = options.network ?? "mainnet";
  const endpoint =
    options.endpoint ??
    (network === "testnet"
      ? "https://testnet.toncenter.com/api/v2/jsonRPC"
      : "https://toncenter.com/api/v2/jsonRPC");

  const retryOptions: RetryAdapterOptions = { ...options.retry };
  if (options.logger !== undefined) retryOptions.logger = options.logger;
  const httpAdapter =
    options.httpAdapter === null
      ? undefined
      : (options.httpAdapter ?? createRetryAdapter(retryOptions));

  return new TonClient({
    endpoint,
    ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    ...(httpAdapter !== undefined ? { httpAdapter } : {}),
  });
}
