import { TON_ADDRESS } from "@toncast/tx-sdk";
import { BettingResource } from "../betting/placeBet";
import { ToncastError } from "../errors";
import { HttpClient } from "../http/HttpClient";
import { resolveLanguage, type SupportedLanguage } from "../i18n/languages";
import { BetsResource } from "../resources/bets";
import { CategoriesResource } from "../resources/categories";
import { CoinsResource } from "../resources/coins";
import { ParisResource } from "../resources/paris";
import { parseTonAddress } from "../utils/address";
import { noopLogger } from "../utils/logger";
import {
  DEFAULT_BASE_URL,
  type Logger,
  type PrefetchConfig,
  type ReferralConfig,
  resolveWsUrlFromApiBaseUrl,
  type ToncastBackgroundTask,
  type TonClient,
  type ToncastClientOptions,
} from "./config";

/**
 * Main facade for all Toncast functionality.
 * Holds the user wallet address so subresources can read it via a shared getter,
 * and lets callers swap it at runtime (wallet reconnect, address change).
 */
export class ToncastClient {
  readonly categories: CategoriesResource;
  readonly paris: ParisResource;
  readonly bets: BetsResource;
  readonly coins: CoinsResource;
  readonly betting: BettingResource;

  private userAddress: string | undefined;
  private language: SupportedLanguage;
  private referral: ReferralConfig | undefined;
  private readonly tonClient: TonClient | undefined;
  private readonly logger: Logger;
  private readonly onBackgroundError:
    | ((error: unknown, task: ToncastBackgroundTask) => void)
    | undefined;
  private readonly http: HttpClient;
  private readonly prefetch: Required<PrefetchConfig>;
  private readonly languageStorageKey: string | null;
  private readonly languageListeners = new Set<(lang: SupportedLanguage) => void>();

  constructor(options: ToncastClientOptions = {}) {
    this.userAddress = options.userAddress
      ? parseTonAddress(options.userAddress, "userAddress")
      : undefined;
    this.languageStorageKey = resolveLanguageStorageKey(options.persistLanguage);
    // Resolution order: explicit `language` option → persisted localStorage → env auto-detect.
    const persisted = readPersistedLanguage(this.languageStorageKey);
    this.language = resolveLanguage(options.language ?? persisted);
    this.referral = validateReferral(options.referral);
    this.tonClient = options.tonClient;
    this.logger = options.logger ?? noopLogger;
    this.onBackgroundError = options.onBackgroundError;

    const resolvedBaseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.http = new HttpClient({
      baseUrl: resolvedBaseUrl,
      getLanguage: () => this.language,
      logger: this.logger,
      maxAttempts: options.maxAttempts ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      requestTimeoutMs: options.requestTimeoutMs ?? 15_000,
      transport: options.transport,
    });

    const getUserAddress = (): string | undefined => this.userAddress;

    this.categories = new CategoriesResource({
      http: this.http,
      getLanguage: () => this.language,
    });
    this.paris = new ParisResource({
      http: this.http,
      wsBaseUrl: options.wsUrl ?? resolveWsUrlFromApiBaseUrl(resolvedBaseUrl),
      getLanguage: () => this.language,
      logger: this.logger,
      streamIdleTimeoutMs: options.streamIdleTimeoutMs ?? 30_000,
    });
    this.bets = new BetsResource({ http: this.http, getUserAddress });
    this.coins = new CoinsResource({
      tonClient: this.tonClient,
      logger: this.logger,
      getUserAddress,
      jettonDiscovery: options.jettonDiscovery,
    });
    this.betting = new BettingResource({
      paris: this.paris,
      coins: this.coins,
      getUserAddress,
      getReferral: () => this.referral,
      tonClient: this.tonClient,
      logger: this.logger,
    });

    this.prefetch = resolvePrefetchConfig(options.prefetch);
    this.prefetchStatic();
  }

  /**
   * Fire-and-forget warm-up of static reference data (currently just
   * `categories`). Runs on construction and on `setLanguage()` — categories
   * are language-keyed in their cache, so a language switch needs its own
   * fetch.
   *
   * Why we do this in the SDK instead of leaving it to the integrator:
   * categories are needed by ~every UI surface and the request is tiny
   * (~1-2 KB). Letting it race the first paris fetch instead of waiting
   * for a component mount removes a visible UX hiccup ("paris appear,
   * categories pop in 200 ms later").
   *
   * Failures are swallowed — a real call later will retry through the
   * normal retry policy and surface its own error.
   */
  /**
   * Bootstrap-only prefetch — runs once from the constructor. Includes
   * categories (cheap) AND triggers `prefetchCoins` which conditionally
   * pulls the 4 MB STON.fi markets snapshot only when a connected wallet
   * holds at least one jetton.
   */
  private prefetchStatic(): void {
    if (this.prefetch.categories) this.prefetchCategoriesOnly();
    if (this.prefetch.coins) this.prefetchCoins();
  }

  /**
   * Refresh ONLY language-dependent reference data. Called on `setLanguage`
   * — coins/markets don't depend on language, so re-running the wallet/swap
   * prefetch (which costs 4 MB on STON.fi) would be wasteful.
   */
  private prefetchCategoriesOnly(): void {
    if (!this.prefetch.categories) return;
    // Failures are logged through the user's logger (default no-op) so an
    // integrator wiring `console` / pino sees what's happening without the
    // SDK throwing on construction. The next real call retries through the
    // normal HTTP retry policy.
    void this.categories.list().catch((err) => {
      this.reportBackgroundError(err, "prefetch.categories");
    });
  }

  /**
   * Fire-and-forget warm of the user's TON + jetton balances. Called from
   * the constructor (when `userAddress` is in options) and `setUserAddress`.
   *
   * Without this warm-up, the first `useBetSummary` (= first modal open)
   * blocks the UI on `getAddressInformation(user)` + `/v3/jetton/wallets`.
   * Since the SDK already caches `coins.list()` for 5 minutes, doing this
   * eagerly costs the same one round-trip but moves it off the user's
   * critical path.
   *
   * Skipped when `prefetch: false`, when no `tonClient` is configured, or
   * when there's no `userAddress` to query against.
   */
  private prefetchCoins(): void {
    if (!this.prefetch.coins) return;
    if (!this.userAddress) return;
    if (!this.tonClient) return;
    void this.coins
      .list()
      .then((coins) => {
        // The 4 MB STON.fi markets snapshot is ONLY needed for jetton-funded
        // bets. TON-only wallets never touch swap routing, so we save the
        // bandwidth + 3-8 s of CPU work entirely. Once a jetton is detected,
        // pre-warm so the first jetton-funded `priceCoins` doesn't block.
        const hasJetton = coins.some((c) => c.address !== TON_ADDRESS);
        if (!hasJetton) return;
        if (!this.prefetch.swapMarkets) return;
        return this.betting.prefetchSwapMarkets(coins).catch((err) => {
          this.reportBackgroundError(err, "prefetch.swapMarkets");
        });
      })
      .catch((err) => {
        // Cache stays empty; next user-driven call re-tries through the
        // normal retry policy and surfaces its own error.
        this.reportBackgroundError(err, "prefetch.coins");
      });
  }

  /**
   * Replace the default user address (e.g. on wallet reconnect). Auto-clears
   * any cached balances for the previous address (they were tied to a now-
   * disconnected wallet) and warms the cache for the new one if `prefetch`
   * is enabled.
   */
  setUserAddress(address: string): void {
    const parsed = parseTonAddress(address, "userAddress");
    if (this.userAddress === address) return;
    // Drop ALL cached balances — we don't want to keep a stale entry for
    // the previous user lying around in memory either.
    this.coins.invalidate();
    this.userAddress = parsed;
    this.prefetchCoins();
  }

  /** Disconnect: forget the current user and drop their cached balances. */
  clearUserAddress(): void {
    this.coins.invalidate();
    this.userAddress = undefined;
  }

  getUserAddress(): string | undefined {
    return this.userAddress;
  }

  /** Replace the preferred language. Accepts any BCP-47 tag, normalises and falls back to "en". */
  setLanguage(language: string): void {
    const next = resolveLanguage(language);
    if (next === this.language) return;
    this.language = next;
    persistLanguage(this.languageStorageKey, next);
    // Categories are cached per-language inside CategoriesResource — kick off
    // the new language's load immediately so the UI doesn't wait for a render.
    // Wallet balances + STON.fi markets do NOT depend on language so we
    // intentionally skip them here (avoids re-pulling the 4 MB markets list
    // on every language switch).
    this.prefetchCategoriesOnly();
    // Active streams hold pari objects fetched in the previous language;
    // force them to re-fetch the REST snapshot so titles / descriptions
    // arrive in the new locale without dropping the WS subscription.
    this.paris.refetchAllStreams();
    for (const fn of this.languageListeners) {
      try {
        fn(next);
      } catch (err) {
        this.reportBackgroundError(err, "language.listener");
      }
    }
  }

  getLanguage(): SupportedLanguage {
    return this.language;
  }

  /**
   * Subscribe to language changes. Listener fires AFTER the new language has
   * been applied (so `client.getLanguage()` already returns the new value)
   * and after caches that depend on it (categories) have been kicked off for
   * a refetch. Returns an unsubscribe function.
   */
  onLanguageChange(listener: (lang: SupportedLanguage) => void): () => void {
    this.languageListeners.add(listener);
    return () => {
      this.languageListeners.delete(listener);
    };
  }

  /** Replace the SDK-level referral. Pass `undefined` to disable. */
  setReferral(referral: ReferralConfig | undefined): void {
    this.referral = validateReferral(referral);
  }

  getReferral(): ReferralConfig | undefined {
    return this.referral;
  }

  /** Stop live streams, sockets, timers, and language listeners owned by this client. */
  dispose(): void {
    this.paris.dispose();
    this.languageListeners.clear();
  }

  private reportBackgroundError(err: unknown, task: ToncastBackgroundTask): void {
    this.logger.warn(`${task} failed`, err);
    this.onBackgroundError?.(err, task);
  }
}

function resolvePrefetchConfig(
  prefetch: ToncastClientOptions["prefetch"],
): Required<PrefetchConfig> {
  if (prefetch === true) {
    return { categories: true, coins: true, swapMarkets: true };
  }
  if (!prefetch) {
    return { categories: false, coins: false, swapMarkets: false };
  }
  return {
    categories: prefetch.categories ?? false,
    coins: prefetch.coins ?? false,
    swapMarkets: prefetch.swapMarkets ?? false,
  };
}

const DEFAULT_LANGUAGE_STORAGE_KEY = "toncast.language";

function resolveLanguageStorageKey(opt: boolean | string | undefined): string | null {
  if (opt === false) return null;
  if (typeof opt === "string") return opt;
  // Default to enabled when localStorage is available (browser).
  if (typeof globalThis === "undefined" || typeof globalThis.localStorage === "undefined") {
    return null;
  }
  return DEFAULT_LANGUAGE_STORAGE_KEY;
}

function readPersistedLanguage(key: string | null): string | undefined {
  if (!key) return undefined;
  try {
    return globalThis.localStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function persistLanguage(key: string | null, value: SupportedLanguage): void {
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // QuotaExceeded / private mode — silently skip persistence.
  }
}

function validateReferral(r: ReferralConfig | undefined): ReferralConfig | undefined {
  if (!r) return undefined;
  if (!Number.isInteger(r.pct) || r.pct < 0 || r.pct > 7) {
    throw new ToncastError(
      `referral.pct must be an integer 0..7, got ${r.pct}`,
      "INVALID_REFERRAL_PCT",
    );
  }
  if (r.pct > 0 && !r.address) {
    throw new ToncastError(
      "referral.address is required when referral.pct > 0",
      "INVALID_REFERRAL",
    );
  }
  if (r.address) parseTonAddress(r.address, "referral.address");
  return r;
}
