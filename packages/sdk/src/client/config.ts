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

export interface ToncastClientOptions {
  /** REST API base URL. */
  baseUrl?: string;
  /** WebSocket base URL. */
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
  /**
   * Eagerly fetch static reference data on `new ToncastClient()` and on
   * `setLanguage()`. Right now this just primes the categories list (rarely
   * changes, almost every UI surface needs it on the first render). Default `true`.
   *
   * Disable in tightly controlled environments where you want zero outbound
   * traffic until you explicitly call a resource method.
   */
  prefetch?: boolean;
}

export const DEFAULT_BASE_URL = "https://toncast.me/api";
/** Base URL for `wss://…/ws/<channel>` endpoints (e.g. `/ws/pari-list`). */
export const DEFAULT_WS_URL = "wss://toncast.me";
