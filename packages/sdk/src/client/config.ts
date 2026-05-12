import type { Client as TonClient } from "@ston-fi/sdk";
import type { JettonDiscoveryOptions } from "../wallet/jetton-discovery";

/**
 * Re-export of `@ston-fi/sdk`'s `Client` (extends `@ton/ton`'s TonClient).
 * Same shape as `tx-sdk`'s re-export — interchangeable.
 */
export type { TonClient };

/** Minimal logger sink. Plug in pino/winston/console or leave as no-op. */
export interface Logger {
  debug(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * A single message in a TonConnect-compatible transaction. The SDK builds
 * these for you (see `toTonConnectMessages`), but the SDK itself does NOT sign
 * or send anything — the integrator is responsible for handing them off to
 * `@tonconnect/sdk`, `@tonconnect/ui`, or any other wallet bridge.
 */
export interface TonConnectMessage {
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
}

/**
 * Shape accepted by `@tonconnect/sdk`'s `sendTransaction()`. Convenience type
 * for integrators — produced by combining `toTonConnectMessages(quote)` with
 * a `validUntil`.
 */
export interface TonConnectTransaction {
  validUntil: number;
  network?: string;
  from?: string;
  messages: TonConnectMessage[];
}

/** Referral attribution applied to every bet unless overridden per call. */
export interface ReferralConfig {
  /** Wallet that earns the referral share. Must NOT equal `beneficiary`. */
  address: string;
  /** Share in percent, integer 0..7 (validated on-chain as uint3). */
  pct: number;
}

export interface PrefetchConfig {
  /** Warm localised categories. */
  categories?: boolean;
  /** Warm wallet TON/jetton balances when `userAddress` + `tonClient` are available. */
  coins?: boolean;
  /** Warm STON.fi swap markets after a jetton balance is detected. */
  swapMarkets?: boolean;
}

export interface ToncastClientOptions {
  /** REST API base URL. */
  baseUrl?: string;
  /**
   * WebSocket origin (`wss://host` or `ws://host`, no path). The SDK appends
   * paths such as `/ws/pari-list` and `/ws/<pariId>`.
   *
   * When omitted, derived from {@link baseUrl} (same host; `https`→`wss`, `http`→`ws`).
   */
  wsUrl?: string;
  /** Default user wallet address. Optional — public endpoints work without it. */
  userAddress?: string;
  /**
   * `Client` from `@ston-fi/sdk` (extends `@ton/ton`'s TonClient).
   * Required for jetton-funded bets and `coins.list()`.
   *
   * Pass the standard toncenter v2 RPC client (the one everyone already uses
   * for TON balance / get-method calls) — `coins.list()` reuses the same
   * endpoint + API key to query toncenter's jetton index internally.
   */
  tonClient?: TonClient;
  /**
   * **Advanced override** for jetton discovery providers. Most integrations
   * leave this `undefined` — defaults work without configuration.
   * See `JettonDiscoveryOptions` for the full shape.
   */
  jettonDiscovery?: JettonDiscoveryOptions;
  /**
   * Default referral attribution applied to every bet prepared through `betting.*`.
   * Per-call `referral` / `referralPct` overrides this. Useful for integrators
   * that always want bets attributed to their own wallet.
   */
  referral?: ReferralConfig;
  /**
   * Preferred language for API responses (Accept-Language header).
   * Accepts any BCP-47 tag — normalised to one of SUPPORTED_LANGUAGES, falls back to "en".
   * If omitted, the SDK reads the persisted choice (see `persistLanguage`),
   * then falls back to `navigator.language` (browser) or "en" (Node).
   */
  language?: string;
  /**
   * Persist the active language to `localStorage` so a refresh / new tab
   * keeps the user's choice.
   *
   *  - `true` (default in browsers) — store under `"toncast.language"`.
   *  - `string` — store under that key.
   *  - `false` — disable persistence.
   *
   * Server / SSR environments default to `false` (no `localStorage`).
   */
  persistLanguage?: boolean | string;
  /** Optional logger. Defaults to no-op. */
  logger?: Logger;
  /** Total HTTP attempts (1 initial + N-1 retries) per request. Default 3. */
  maxAttempts?: number;
  /** Base delay between retries in ms (doubled per attempt). Default 1000. */
  retryDelayMs?: number;
  /** Per-request timeout in ms. Default 15000. Set `0` to disable. */
  requestTimeoutMs?: number;
  /**
   * How long live streams stay warm after their last subscriber leaves.
   * Default `30000`. Set `0` to stop immediately or `false` to keep streams
   * alive until `stop()` / `client.dispose()`.
   */
  streamIdleTimeoutMs?: number | false;
  /**
   * Eagerly fetch reference/wallet data. Default `false` — constructing a
   * client is pure unless prefetch is requested explicitly.
   *
   * `true` enables the legacy full warm-up. Prefer the object form in
   * production so each network side effect is intentional.
   */
  prefetch?: boolean | PrefetchConfig;
}

export const DEFAULT_BASE_URL = "https://toncast.me/api";
/** Base URL for `wss://…/ws/<channel>` endpoints (e.g. `/ws/pari-list`). */
export const DEFAULT_WS_URL = "wss://toncast.me";

/**
 * Derives a WebSocket origin from a Toncast REST base URL. Only `protocol` and `host`
 * are used (path/query are ignored). Invalid URLs fall back to {@link DEFAULT_WS_URL}.
 */
export function resolveWsUrlFromApiBaseUrl(apiBaseUrl: string): string {
  try {
    const u = new URL(apiBaseUrl);
    const wsProtocol =
      u.protocol === "https:" ? "wss:" : u.protocol === "http:" ? "ws:" : u.protocol;
    return `${wsProtocol}//${u.host}`;
  } catch {
    return DEFAULT_WS_URL;
  }
}
