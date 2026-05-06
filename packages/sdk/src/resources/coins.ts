import { Address } from "@ton/ton";
import { TON_ADDRESS } from "@toncast/tx-sdk";
import type { Logger, TonClient } from "../client/config";
import { ToncastError } from "../errors";
import { discoverJettons, type JettonDiscoveryOptions } from "../wallet/jetton-discovery";

export interface CoinsResourceDeps {
  tonClient?: TonClient;
  logger: Logger;
  getUserAddress: () => string | undefined;
  /** Advanced override for jetton discovery providers — see `JettonDiscoveryOptions`. */
  jettonDiscovery?: JettonDiscoveryOptions;
  /** Cache TTL in ms. Default 5 minutes. Pass `0` or `Infinity` to disable expiry. */
  cacheTtlMs?: number;
}

/**
 * A single fundable coin. Compatible with `@toncast/tx-sdk`'s `AvailableCoin`
 * — passable straight into `priceCoins`.
 */
export interface AvailableCoin {
  address: string;
  amount: bigint;
  symbol?: string;
  decimals?: number;
}

export interface ListCoinsParams {
  userAddress?: string;
  signal?: AbortSignal;
  /** Per-call override for jetton discovery providers (overrides client-level). */
  jettonDiscovery?: JettonDiscoveryOptions;
  /**
   * Skip the cache for THIS call only (forces a fresh fetch). The result still
   * lands in cache for subsequent calls. Equivalent to `refresh()` but per-shot.
   */
  noCache?: boolean;
}

interface CacheEntry {
  coins: AvailableCoin[];
  fetchedAt: number;
}

/** Default cache TTL — 5 minutes. Balances can change between blocks but
 * almost never per-modal-open, and any user-initiated bet path explicitly
 * invalidates via `invalidate()` / `refresh()`. */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Reads the user's wallet balances:
 * - **TON balance** via `tonClient.getBalance(addr)` (always).
 * - **All jettons** via toncenter v3 jetton index. The discovery URL is
 *   derived from the user's TonClient endpoint (`/api/v2/jsonRPC` →
 *   `/api/v3`, same API key) — **toncenter is the only source**, there is
 *   no third-party fallback.
 *
 * Discovery failures degrade gracefully — the call still returns TON-only with
 * a warning logged. There is no hardcoded jetton whitelist; `priceCoins`
 * downstream decides which discovered jettons are exchangeable through STON.fi.
 *
 * **Caching.** Whole-list results are cached **per normalised user address**
 * for `cacheTtlMs` (default 5 min). Sequential `list()` calls within the
 * window — including those triggered by `useBetSummary` per pari card — hit
 * the cache and skip both `getAddressInformation` (TON balance) and
 * `/v3/jetton/wallets` (jetton index). Concurrent in-flight calls dedup to
 * one network round-trip.
 *
 * Use `refresh()` (eager) right after a confirmed bet to fetch fresh balances,
 * or `invalidate()` (lazy) to drop the entry and let the next `list()` reload.
 */
export class CoinsResource {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<AvailableCoin[]>>();
  private readonly cacheTtlMs: number;

  constructor(private readonly deps: CoinsResourceDeps) {
    this.cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  async list(params: ListCoinsParams = {}): Promise<AvailableCoin[]> {
    const rawAddr = params.userAddress ?? this.deps.getUserAddress();
    if (!rawAddr) {
      throw new ToncastError("coins.list requires userAddress", "USER_ADDRESS_REQUIRED");
    }
    if (!this.deps.tonClient) {
      throw new ToncastError(
        "coins.list requires tonClient — pass it in ToncastClient options.",
        "TON_CLIENT_REQUIRED",
      );
    }

    const key = normaliseAddress(rawAddr);

    if (!params.noCache) {
      const cached = this.cache.get(key);
      if (cached && this.isFresh(cached)) return cached.coins;
      const pending = this.inflight.get(key);
      if (pending) return pending;
    }

    const tonClient = this.deps.tonClient;
    const owner = Address.parse(rawAddr);
    const discoveryOpts = params.jettonDiscovery ?? this.deps.jettonDiscovery;

    const promise = (async () => {
      const [tonBalance, jettons] = await Promise.all([
        tonClient.getBalance(owner),
        discoverJettons(rawAddr, tonClient, this.deps.logger, params.signal, discoveryOpts),
      ]);
      const coins: AvailableCoin[] = [{ address: TON_ADDRESS, amount: tonBalance }];
      for (const j of jettons) {
        coins.push({
          address: j.address,
          amount: j.amount,
          symbol: j.symbol,
          decimals: j.decimals,
        });
      }
      this.cache.set(key, { coins, fetchedAt: Date.now() });
      return coins;
    })().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Drop the cache entry for `userAddress` (or every address if omitted).
   * Lazy — does NOT fetch. The next `list()` call will reload from network.
   *
   * Use after `confirmQuote` → `sendTransaction` if you don't need the new
   * balance immediately. For an eager refetch use `refresh()` instead.
   */
  invalidate(userAddress?: string): void {
    if (userAddress) {
      const key = normaliseAddress(userAddress);
      this.cache.delete(key);
      this.inflight.delete(key);
    } else {
      this.cache.clear();
      this.inflight.clear();
    }
  }

  /**
   * Drop the cache entry AND immediately fetch fresh balances. Returns the
   * new list. Use after a bet so the next render of `useBetSummary` (or any
   * `priceCoins`/UI surface) gets up-to-date numbers without an extra round
   * trip from the consumer.
   */
  async refresh(userAddress?: string): Promise<AvailableCoin[]> {
    const addr = userAddress ?? this.deps.getUserAddress();
    if (!addr) {
      throw new ToncastError("coins.refresh requires userAddress", "USER_ADDRESS_REQUIRED");
    }
    this.invalidate(addr);
    return this.list({ userAddress: addr });
  }

  private isFresh(entry: CacheEntry): boolean {
    if (!Number.isFinite(this.cacheTtlMs)) return true;
    if (this.cacheTtlMs <= 0) return false;
    return Date.now() - entry.fetchedAt < this.cacheTtlMs;
  }
}

/**
 * Canonical key for our cache map. `Address.parse` accepts every TON address
 * format the wallet ecosystem uses (`UQ…`, `EQ…`, raw `0:…`); without
 * normalisation a user reconnecting via TonConnect could appear under two
 * different keys for the same physical wallet. `.toString()` returns the
 * canonical bounceable EQ-form, which is also what tx-sdk and STON.fi sign
 * everything against.
 */
function normaliseAddress(addr: string): string {
  try {
    return Address.parse(addr).toString();
  } catch {
    return addr;
  }
}
