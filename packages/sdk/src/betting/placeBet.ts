import {
  type AvailableCoin,
  availableForBet,
  availableTickets,
  type BetQuote,
  type CommonBetParams,
  DEFAULT_WALLET_RESERVE,
  type FixedBetParams,
  type LimitBetParams,
  type MarketBetParams,
  ODDS_MAX,
  ODDS_MIN,
  ODDS_STEP,
  PARI_EXECUTION_FEE,
  type PricedCoin,
  TON_ADDRESS,
  ToncastTxSdk,
  type TxParams,
  ticketCost,
} from "@toncast/tx-sdk";
import type { Logger, ReferralConfig, TonClient, TonConnectMessage } from "../client/config";
import { ToncastError } from "../errors";
import type { CoinsResource } from "../resources/coins";
import type { ParisResource } from "../resources/paris";
import type { OddsState } from "../types/odds-state";
import type { Pari } from "../types/pari";
import { parseTonAddress } from "../utils/address";
import { ToncastObservable } from "../utils/observable";
import { CachedStonApiClient } from "../wallet/cached-ston-api";
import { assertPositiveUint32TicketCount } from "./validateTicketsCount";

/** Re-exported for downstream apps that don't want to depend on tx-sdk directly. */
export type { AvailableCoin, BetQuote, PricedCoin } from "@toncast/tx-sdk";

/**
 * Pull `apiKey` out of a `TonClient` if one was configured. Lives on a
 * non-public field path (`client.api.parameters.apiKey`), but it's stable
 * across `@ston-fi/sdk` versions — used here only to pick smarter defaults
 * for the throttler (presence of a key ≈ no rate-limit headroom worry).
 */
/**
 * Synthesise a TON-only `PricedCoin[]` from the wallet's raw `coins.list()`.
 * TON pays directly (no swap routing → no STON.fi markets needed), so we
 * can hand the React layer a betting-ready coin within ~200 ms of the
 * modal opening — well before the 3-8 s `priceCoins(jettons)` round-trip
 * resolves. {@link BettingResource.subscribeSummary} emits this snapshot
 * first and replaces it with the fully-routed list in phase 2.
 *
 * Returns at most one entry (TON itself); jettons live separately on
 * `BetSummary.loadingCoins` while phase 2 is in flight.
 */
function synthesizeTonOnlyPricedCoins(
  allCoins: AvailableCoin[],
  walletReserveOpt: bigint | undefined,
): PricedCoin[] {
  const tonCoin = allCoins.find((c) => c.address === TON_ADDRESS);
  if (!tonCoin) return [];
  const reserve = walletReserveOpt ?? DEFAULT_WALLET_RESERVE;
  const usable = tonCoin.amount > reserve ? tonCoin.amount - reserve : 0n;
  return [
    {
      address: TON_ADDRESS,
      amount: tonCoin.amount,
      symbol: "TON",
      decimals: 9,
      tonEquivalent: usable,
      tonEquivalentExpected: usable,
      gasReserve: 0n,
      route: null,
      viable: usable > 0n,
      reason: usable > 0n ? undefined : "insufficient_balance",
    } as PricedCoin,
  ];
}

function readApiKey(tonClient: TonClient | undefined): string | undefined {
  if (!tonClient) return undefined;
  return (tonClient as unknown as { api?: { parameters?: { apiKey?: string } } }).api?.parameters
    ?.apiKey;
}

/**
 * Output of `confirmQuote` — a finalised quote bundled with both transaction shapes
 * the integrator may need. Sign and send `messages` (TonConnect) or `txs` (raw).
 */
export interface ConfirmedQuote {
  /** Underlying tx-sdk quote, with all metadata (cost breakdown, route, warnings…). */
  quote: BetQuote;
  /** Raw transactions in tx-sdk's `TxParams` shape. Use this if your wallet bridge isn't TonConnect. */
  txs: TxParams[];
  /** Same transactions in TonConnect's `Message[]` shape — ready for `sendTransaction({ messages, validUntil })`. */
  messages: TonConnectMessage[];
}

export interface BettingResourceDeps {
  paris: ParisResource;
  coins: CoinsResource;
  getUserAddress: () => string | undefined;
  /** Per-call resolver for the SDK-level referral default. */
  getReferral: () => ReferralConfig | undefined;
  tonClient?: TonClient | undefined;
  logger?: Logger | undefined;
}

/** Convenience wrapper for tx-sdk's `priceCoins`. */
export interface PriceCoinsOptions {
  /** Override the auto-fetched coin list. */
  availableCoins?: AvailableCoin[] | undefined;
  slippage?: string | undefined;
  walletReserve?: bigint | undefined;
}

export interface QuoteCommon {
  pariId: string;
  isYes: boolean;
  source: string;
  /**
   * Wallet that **owns the resulting tickets** (receives payout on win).
   * Defaults to `client.userAddress` — you bet for yourself.
   */
  beneficiary?: string | undefined;
  /**
   * Wallet that **signs and funds** the transaction (the TonConnect-bound wallet).
   * Defaults to `client.userAddress`.
   *
   * Override only for bet-on-behalf flows where the signer differs from the
   * beneficiary. **Critical for jetton sources**: STON.fi derives the
   * jetton-wallet to pull tokens from using this address — wrong value
   * means the swap fails at the first hop.
   */
  senderAddress?: string | undefined;
  /**
   * Optional address that earns `referralPct` of winnings.
   * - Must be non-null when `referralPct > 0`.
   * - Must NOT equal `beneficiary` (enforced by tx-sdk).
   * - May equal `senderAddress` (agent self-refers).
   */
  referral?: string | null | undefined;
  /** Referral share, 0..7 (validated on-chain as uint3). Default 0. */
  referralPct?: number | undefined;
  slippage?: string | undefined;
  walletReserve?: bigint | undefined;
  pricedCoins?: PricedCoin[] | undefined;
  allowInsufficientBalance?: boolean | undefined;
  /**
   * Required before `confirmQuote` can return signable transactions. Put this
   * on quote params when you want `confirmQuote(quote)` auto-tracking to work.
   */
  financialRiskAcknowledged?: true | undefined;
}

export type ConfirmQuoteParams = QuoteCommon & {
  financialRiskAcknowledged: true;
};

export interface QuoteFixedBetParams extends QuoteCommon {
  yesOdds: number;
  ticketsCount: number;
  /**
   * Current odds snapshot. When omitted the SDK fetches it automatically.
   * Providing it avoids an extra round-trip when the caller already has
   * `summary.oddsState` in hand.
   */
  oddsState?: OddsState | undefined;
}

export interface QuoteLimitBetParams extends QuoteCommon {
  worstYesOdds: number;
  ticketsCount: number;
  oddsState?: OddsState | undefined;
}

/**
 * Market bet — buy at the best available counter-side prices, in order.
 * Two ways to size the bet, choose ONE:
 *
 * - `marketTickets`: integer "give me N matched tickets". UX-friendly for
 *   slider-driven UIs where each tick = 1 ticket. Zero placement risk —
 *   the SDK pre-computes the exact budget for those N tickets out of the
 *   current order book and calls tx-sdk with it.
 * - `maxBudgetTon`: "spend up to X TON, take whatever fills". Classic
 *   "market order with cap" semantics. Any leftover that doesn't cleanly
 *   buy a matched ticket is dropped (we re-quote at matched-only cost
 *   internally) — never opens a new ask in the book.
 */
export type QuoteMarketBetParams = QuoteCommon & {
  oddsState?: OddsState | undefined;
} & (
    | {
        /** Spend up to this much TON across matched legs. Mutually exclusive with `marketTickets`. */
        maxBudgetTon: bigint;
        marketTickets?: never;
      }
    | {
        /** Buy exactly this many matched tickets. Mutually exclusive with `maxBudgetTon`. */
        marketTickets: number;
        maxBudgetTon?: never;
      }
  );

/**
 * Snapshot of how much liquidity is available for a market bet on a given
 * side, broken down by yesOdds bucket (lowest cost first for the bettor).
 *
 * `legs` is always sorted by ticket-buying preference: cheapest tickets
 * for the chosen side first.
 *
 * - `maxTickets` — RAW book depth, ignoring caller budget. Use this for
 *   "what if I had more money" UI hints and for the upper bound of free-
 *   form ticket inputs.
 * - `affordableTickets` — clipped to whatever `opts.maxBudgetTon` can
 *   actually buy (greedy from cheapest leg, including
 *   `PARI_EXECUTION_FEE` per touched bucket). Equals `maxTickets` when no
 *   budget was passed. Use this for the slider / step-buttons hard cap.
 */
export interface MarketCapacity {
  maxTickets: number;
  affordableTickets: number;
  legs: { yesOdds: number; available: number; ticketCostTon: bigint }[];
}

/** Per-coin betting capacity, keyed off a `PricedCoin` and shared scalars. */
export interface CoinCapacity {
  source: AvailableCoin;
  feasible: boolean;
  reason?: string | undefined;
  /**
   * Smallest possible bet via this coin in nano-TON.
   * = ticketCost(yesOdds=2) + PARI_EXECUTION_FEE = 0.02 + 0.1 = 0.12 TON.
   */
  minBetTon: bigint;
  /** Largest possible bet via this coin in nano-TON (after wallet reserve / swap gas). */
  maxBetTon: bigint;
  route?: PricedCoin["route"] | undefined;
}

export interface BetSummary {
  pari: Pari;
  oddsState: OddsState;
  pricedCoins: PricedCoin[];
  capacities: CoinCapacity[];
  /** Universal floor — bet of 1 ticket at lowest possible odds. */
  minBetTon: bigint;
  /** Pari-side execution fee (constant from tx-sdk). */
  perBetExecutionFeeTon: bigint;
  /**
   * Market-side book depth + per-yesOdds `legs` for both sides. Derived
   * synchronously from `oddsState`, so a single `summary(pariId)` call
   * gives the UI everything it needs to drive a market-bet builder
   * (slider caps, ticket↔budget conversions) WITHOUT a follow-up
   * `marketCapacity()` round-trip.
   *
   * Per-coin "affordable tickets" is a wallet-side calculation —
   * compute it locally with {@link BettingResource.ticketsForBudget}
   * over `selectedCap.maxBetTon`; the same function the SDK uses
   * internally.
   */
  marketYes: MarketCapacity;
  marketNo: MarketCapacity;
  /**
   * Wallet coins whose pricing is still being computed via STON.fi — set
   * during phase 1 of {@link BettingResource.subscribeSummary} (TON-only
   * fast path) and an empty array in phase 2 (and in `summary()`). Surface
   * these in the coin selector as "loading" so the user knows their
   * jetton balances exist before swap routing finishes.
   */
  loadingCoins: AvailableCoin[];
}

/**
 * High-level betting facade. Wraps `@toncast/tx-sdk` for all economics
 * (priceCoins, quote*, confirmQuote) and exposes them with auto-resolved
 * addresses (signer / beneficiary / referral) and SDK-level defaults.
 *
 * Pipeline:
 *   `summary` (or manual `priceCoins`) → `quoteXxxBet` → `confirmQuote` → `toTonConnectMessages`
 *
 * `confirmQuote` is **mandatory** before signing — it re-simulates the STON.fi
 * route on jetton sources and verifies the quote is still feasible. Skipping it
 * is a money-losing footgun (slippage drift, stale rates).
 *
 * The SDK never signs or broadcasts. Hand the resulting `TxParams[]` /
 * `TonConnectMessage[]` to your wallet bridge of choice.
 *
 * @throws `ToncastError` for invalid addresses or disallowed referral combinations;
 *   `ToncastApiError` (and HTTP subclasses) when REST/STON calls fail; `ToncastValidationError`
 *   when API responses fail schema checks.
 */
export class BettingResource {
  private txSdk: ToncastTxSdk | null = null;
  /** Set once `getTxSdk()` runs — used by `confirmQuote` to drop the SDK-side
   * synthetic snapshots so the pre-signing simulation hits the real API. */
  private cachedApi: CachedStonApiClient | null = null;
  // Captures the params each `quoteXxxBet` call was made with, keyed by the
  // returned BetQuote object. Lets `confirmQuote(quote)` work without re-passing
  // the original params. WeakMap = no leaks; quote is GC'd → entry gone.
  private readonly paramsByQuote = new WeakMap<BetQuote, QuoteCommon>();
  // In-flight dedupe for `prefetchSwapMarkets` — multiple parallel callers
  // (constructor + setUserAddress + first useBetSummary) all share the same
  // promise instead of triggering N separate 4 MB downloads.
  private inflightSwapMarkets: Promise<void> | null = null;

  constructor(private readonly deps: BettingResourceDeps) {}

  /** Lazy: instantiates a single ToncastTxSdk. Pure-TON flow works without `tonClient`. */
  private getTxSdk(): ToncastTxSdk {
    if (!this.txSdk) {
      // tx-sdk's defaults assume the cautious public Toncenter tier
      // (1000 ms between tonClient calls). With an API key we can fire
      // calls in parallel; without a key we still tighten the limit so a
      // single quote doesn't burn 5+ s on serial RPCs. STON.fi's API is
      // unauthenticated and doesn't enforce a per-IP RPS limit at this
      // time — we can drop the throttle entirely.
      const hasApiKey = readApiKey(this.deps.tonClient) != null;
      // Decorated STON.fi client: linearly extrapolates `simulate?` between
      // bets to avoid one network call per pari modal. Cleared explicitly
      // in `confirmQuote` so user-facing commits always hit the real API.
      // Diagnostic callback wires into a globally-toggleable flag so the
      // browser can opt in (`window.__TONCAST_DEBUG_SIMULATE = true`)
      // without rebuilding the SDK; otherwise zero overhead.
      // The entire branch is stripped by esbuild/rollup in production builds.
      this.cachedApi = new CachedStonApiClient(
        undefined,
        undefined,
        getNodeEnv() !== "production"
          ? (event) => {
              // biome-ignore lint/suspicious/noExplicitAny: opt-in dev hook
              const g = globalThis as any;
              if (g.__TONCAST_DEBUG_SIMULATE) {
                // `console.log` (not .debug) — Chrome hides .debug by default.
                // eslint-disable-next-line no-console
                console.log(
                  `[toncast cached-ston-api] ${event.action}`,
                  event.key,
                  `units=${event.requestedUnits}`,
                  event.anchorUnits != null ? `anchor=${event.anchorUnits}` : "",
                );
              }
            }
          : undefined,
      );
      this.txSdk = new ToncastTxSdk({
        ...(this.deps.tonClient ? { tonClient: this.deps.tonClient } : {}),
        apiClient: this.cachedApi,
        // /v1/markets is a ~40K-row pair list that almost never changes
        // (new pools appear maybe a few times a day). The default 5-min
        // TTL would force a 3-8 s re-fetch on every 5-min boundary for
        // zero observable benefit.
        pairsCacheTtlMs: Number.POSITIVE_INFINITY,
        // STON.fi `simulate?` cache: keep results "forever" within a session.
        // tx-sdk's `confirmQuote()` ALREADY calls `clearRateCache()` internally
        // before re-simulating jetton-funded quotes prior to signing — so the
        // user always sees a fresh rate at the moment of intent. Outside that
        // critical path (rendering quote previews, slider drags, modal re-
        // opens), reusing a cached rate keeps the UI snappy and slashes
        // STON.fi traffic by an order of magnitude.
        rateCacheTtlMs: Number.POSITIVE_INFINITY,
        rateLimits: {
          tonClient: { minIntervalMs: hasApiKey ? 50 : 250 },
          stonApi: { minIntervalMs: 0 },
        },
      });
    }
    return this.txSdk;
  }

  /**
   * Value the user's coins in TON. Auto-reads balances via `coins.list()` if
   * `availableCoins` is not supplied.
   */
  async priceCoins(opts: PriceCoinsOptions = {}): Promise<PricedCoin[]> {
    const txSdk = this.getTxSdk();
    let availableCoins = opts.availableCoins;
    if (!availableCoins) {
      availableCoins = await this.deps.coins.list();
    }
    return txSdk.priceCoins({
      availableCoins,
      ...(opts.slippage !== undefined ? { slippage: opts.slippage } : {}),
      ...(opts.walletReserve !== undefined ? { walletReserve: opts.walletReserve } : {}),
    });
  }

  /**
   * Warm up tx-sdk's official `priceCoins` path so STON.fi route discovery
   * happens before the first betting UI interaction. This intentionally avoids
   * reaching into tx-sdk private cache fields; if tx-sdk changes internals, the
   * public pricing contract is still the only dependency.
   *
   * No-op without `tonClient` (jetton-funded paths aren't reachable anyway).
   */
  async prefetchSwapMarkets(availableCoins?: AvailableCoin[]): Promise<void> {
    if (!this.deps.tonClient) return;
    // De-dupe parallel callers — route discovery may fetch a large STON.fi
    // markets snapshot, so duplicated warm-ups waste bandwidth and CPU.
    if (this.inflightSwapMarkets) return this.inflightSwapMarkets;
    this.inflightSwapMarkets = this.priceCoins({
      ...(availableCoins !== undefined ? { availableCoins } : {}),
    })
      .then(() => undefined)
      .catch((err) => {
        // First real `priceCoins()` will retry and surface through the normal path.
        this.deps.logger?.warn?.("prefetchSwapMarkets failed", err);
      })
      .finally(() => {
        this.inflightSwapMarkets = null;
      });
    return this.inflightSwapMarkets;
  }

  /**
   * Fixed-price bet: place `ticketsCount` tickets at exactly `yesOdds`.
   *
   * On-chain the contract first matches any existing counter-side orders at
   * that odds level, then opens a new ask for the remainder. `tx-sdk`'s
   * `quoteFixedBet` puts the whole order into `breakdown.matched` regardless
   * of liquidity — we split it here using `availableTickets(oddsState, …)`
   * so the breakdown shows the real matched/placement amounts.
   */
  async quoteFixedBet(params: QuoteFixedBetParams): Promise<BetQuote> {
    assertPositiveUint32TicketCount(params.ticketsCount);
    const quote = await this.runQuote(params, (common) =>
      this.getTxSdk().quoteFixedBet({
        ...common,
        yesOdds: params.yesOdds,
        ticketsCount: params.ticketsCount,
      } satisfies FixedBetParams),
    );
    const oddsState = params.oddsState ?? (await this.deps.paris.getOddsState(params.pariId));
    const isYes = params.isYes;
    const counterAvailable = availableTickets(oddsState, isYes, params.yesOdds);
    const matchedTickets = Math.min(counterAvailable, params.ticketsCount);
    const placedTickets = params.ticketsCount - matchedTickets;
    if (placedTickets <= 0) return quote;
    const fixedEntry = quote.breakdown.matched[0];
    if (!fixedEntry) return quote;
    const perTicketCost = (fixedEntry.cost - PARI_EXECUTION_FEE) / BigInt(params.ticketsCount);
    return {
      ...quote,
      breakdown: {
        ...quote.breakdown,
        matched:
          matchedTickets > 0
            ? [
                {
                  yesOdds: params.yesOdds,
                  tickets: matchedTickets,
                  cost: PARI_EXECUTION_FEE + perTicketCost * BigInt(matchedTickets),
                },
              ]
            : [],
        placement: {
          yesOdds: params.yesOdds,
          tickets: placedTickets,
          cost:
            (matchedTickets > 0 ? 0n : PARI_EXECUTION_FEE) + perTicketCost * BigInt(placedTickets),
        },
      },
    };
  }

  async quoteLimitBet(params: QuoteLimitBetParams): Promise<BetQuote> {
    assertPositiveUint32TicketCount(params.ticketsCount);
    return this.runQuote(params, async (common) => {
      const oddsState = params.oddsState ?? (await this.deps.paris.getOddsState(params.pariId));
      return this.getTxSdk().quoteLimitBet({
        ...common,
        oddsState,
        worstYesOdds: params.worstYesOdds,
        ticketsCount: params.ticketsCount,
      } satisfies LimitBetParams);
    });
  }

  /**
   * Market bet — match existing counter-side liquidity, stop when it's gone.
   *
   * Two ways to size the bet (see {@link QuoteMarketBetParams}):
   *
   * - `marketTickets`: ticket-driven. Caller specifies how many matched
   *   tickets they want; SDK pre-computes the exact budget that buys
   *   exactly that many out of the current book.
   * - `maxBudgetTon`: budget-driven. Caller specifies the TON ceiling;
   *   SDK takes whatever fills.
   *
   * **Both paths guarantee NO placement** in the resulting quote. The
   * upstream `@toncast/tx-sdk` would otherwise place leftover budget as a
   * fresh ask at the best matched price (Limit-mode behaviour). For
   * Market-mode that means "your money buys tickets that may never pay
   * out, even if your side wins" — the production Toncast frontend
   * deliberately avoids that, and so do we.
   */
  async quoteMarketBet(params: QuoteMarketBetParams): Promise<BetQuote> {
    // Cheap validation up-front, before we touch the network or a TonClient.
    if (params.marketTickets !== undefined) {
      assertPositiveUint32TicketCount(params.marketTickets, "marketTickets");
    }
    return this.runQuote(params, async (common) => {
      const oddsState = params.oddsState ?? (await this.deps.paris.getOddsState(params.pariId));
      const txSdk = this.getTxSdk();

      // Ticket-driven path. Two cases:
      //
      //   1. N ≤ book depth — we can fill entirely from existing
      //      counter-side liquidity. Pre-compute the EXACT budget that
      //      buys the first N matched tickets and call tx-sdk with it.
      //      `computeMarketBets` then exits before its placement branch:
      //      no leftover ⇒ no new ask ⇒ user gets a clean matched-only
      //      quote (production Toncast behaviour).
      //
      //   2. N > book depth — matched tickets cover the book; the rest
      //      becomes a "placement" leg (a NEW ask at the best matched
      //      price, sitting in the book waiting for someone to take it).
      //      Reach into tx-sdk's stock behaviour for that leg by sizing
      //      the budget = matched-cost + leftover_tickets × bestPrice.
      //      tx-sdk emits the placement automatically; UI shows it.
      if (params.marketTickets !== undefined) {
        const cap = computeMarketCapacity(oddsState, common.isYes);
        const N = params.marketTickets;
        if (cap.maxTickets === 0) {
          throw new ToncastError(
            "No matched market liquidity for the requested side.",
            "NO_LIQUIDITY",
          );
        }
        const matchedBudget = budgetForFirstNTickets(cap.legs, Math.min(N, cap.maxTickets));
        let targetBudget = matchedBudget;
        if (N > cap.maxTickets) {
          const overflow = N - cap.maxTickets;
          // Placement always lives at the FIRST (cheapest-for-bettor)
          // matched yesOdds in tx-sdk's `computeMarketBets`.
          const bestLeg = cap.legs[0];
          if (bestLeg) {
            targetBudget += BigInt(overflow) * bestLeg.ticketCostTon;
          }
        }
        return txSdk.quoteMarketBet({
          ...common,
          oddsState,
          maxBudgetTon: targetBudget,
        } satisfies MarketBetParams);
      }

      // Budget-driven path: behave like upstream, but trim placement.
      const first = await txSdk.quoteMarketBet({
        ...common,
        oddsState,
        maxBudgetTon: params.maxBudgetTon,
      } satisfies MarketBetParams);
      if (!first.breakdown.placement) return first;
      // matched[i].cost already includes one PARI_EXECUTION_FEE per leg,
      // so summing them gives the total budget needed to buy exactly the
      // matched tickets and nothing more.
      const matchedOnlyBudget = first.breakdown.matched.reduce((sum, m) => sum + m.cost, 0n);
      if (matchedOnlyBudget === 0n) return first;
      return txSdk.quoteMarketBet({
        ...common,
        oddsState,
        maxBudgetTon: matchedOnlyBudget,
      } satisfies MarketBetParams);
    });
  }

  /**
   * How much matched liquidity is available for a market bet on `isYes` side?
   * Returns the maximum number of tickets the SDK can buy via `quoteMarketBet`
   * plus the per-bucket breakdown so callers can drive a "1 step = 1 ticket"
   * slider locally without any extra round-trips.
   *
   * Pass either a `pariId` (SDK fetches `oddsState` for you) or an existing
   * `OddsState` snapshot you already have in hand (no network call).
   *
   * `opts.maxBudgetTon` is an optional budget ceiling: when provided, the
   * returned `maxTickets` is clipped to whatever the budget can buy greedily
   * (cheapest leg first, per-entry `PARI_EXECUTION_FEE` accounted). Use this
   * to drive a slider bounded by the user's wallet rather than raw book depth.
   */
  async marketCapacity(
    source: string | OddsState,
    isYes: boolean,
    opts: { maxBudgetTon?: bigint } = {},
  ): Promise<MarketCapacity> {
    const oddsState =
      typeof source === "string" ? await this.deps.paris.getOddsState(source) : source;
    const cap = computeMarketCapacity(oddsState, isYes);
    // Note: `affordableTickets` can exceed `maxTickets` when the budget
    // covers more than the book has matched-side — the surplus becomes a
    // placement leg. Clamping here would hide that the user can still
    // place a meaningful bet beyond raw book depth.
    const affordableTickets =
      opts.maxBudgetTon === undefined
        ? cap.maxTickets
        : ticketsAffordable(cap.legs, opts.maxBudgetTon);
    return { ...cap, affordableTickets };
  }

  /**
   * Convert a TON amount into the corresponding `source` jetton units using
   * the rate captured by `priceCoins`. Returns `tonAmount` unchanged for TON
   * (1:1 by definition).
   *
   * `mode` picks which side of the STON.fi quote to use. Mirrors what the
   * production Toncast frontend does in each context:
   *
   * - `"worst"` (default) — uses `tonEquivalent` (slippage-floor delivery
   *   of the full balance). For TON→source conversions this gives the
   *   PESSIMISTIC source-units estimate: how much the user would have to
   *   pay if the rate drifts to the slippage edge. This is what production
   *   shows in cost summaries (`Итого 2.668 TON ≈ 26.85 TCAST`) so the
   *   number doesn't quietly understate the wallet outlay.
   * - `"expected"` — uses `tonEquivalentExpected` (= STON.fi's
   *   `swapRate × amount`). Optimistic, useful for forward "what you'll
   *   receive" displays where you want to encourage the action.
   *
   * Note: neither mode is the EXACT amount `confirmQuote` will lock in
   * just before signing — that comes from a fresh `simulateReverseSwap`
   * and may differ slightly with rate drift. Use this for previews; the
   * wallet's signing dialog displays the final locked amount.
   */
  convertTonToSource(
    coin: PricedCoin,
    tonAmount: bigint,
    mode: "expected" | "worst" = "worst",
  ): bigint {
    if (isTonAddress(coin.address)) return tonAmount;
    const denom = mode === "worst" ? coin.tonEquivalent : coin.tonEquivalentExpected;
    if (!denom || denom === 0n) return 0n;
    return (coin.amount * tonAmount) / denom;
  }

  /**
   * Inverse of {@link convertTonToSource}: convert a `source` jetton amount
   * (raw units) into TON using the rate captured by `priceCoins`. Returns
   * the input unchanged for TON (1:1).
   *
   * Uses the same `tonEquivalent` / `tonEquivalentExpected` linear-extrapolation
   * we use elsewhere — good enough for previews ("Amount you typed: N TCAST
   * ≈ X TON"); never for actual settlement, which goes through tx-sdk's
   * fresh `simulateReverseSwap` inside `confirmQuote`.
   *
   * Pass `mode = "expected"` for forward-display semantics, `"worst"` (default)
   * for cost-summary semantics. See {@link convertTonToSource} for the full
   * rationale.
   */
  convertSourceToTon(
    coin: PricedCoin,
    sourceUnits: bigint,
    mode: "expected" | "worst" = "worst",
  ): bigint {
    if (isTonAddress(coin.address)) return sourceUnits;
    if (!coin.amount || coin.amount === 0n) return 0n;
    const num = mode === "worst" ? coin.tonEquivalent : coin.tonEquivalentExpected;
    if (!num) return 0n;
    return (sourceUnits * num) / coin.amount;
  }

  /**
   * Exact TON cost of taking `n` matched tickets out of `legs` greedily,
   * with one `PARI_EXECUTION_FEE` per touched bucket. Overflow past book
   * depth is priced at the cheapest leg (placement) — same accounting
   * the SDK uses internally when sizing budget for `quoteMarketBet`.
   *
   * Pure / synchronous — drives "1 step = 1 ticket" sliders and amount
   * inputs without an extra round-trip per keystroke.
   */
  costForTickets(legs: MarketCapacity["legs"], n: number): bigint {
    return budgetForFirstNTickets(legs, n);
  }

  /**
   * Maximum number of whole tickets a TON budget can fund greedily —
   * inverse of {@link costForTickets}. Counts matched tickets cheapest-
   * first (one `PARI_EXECUTION_FEE` per touched leg) plus any leftover
   * placement at `legs[0]`.
   *
   * Pure / synchronous — use to clamp / parse user input.
   */
  ticketsForBudget(legs: MarketCapacity["legs"], budgetTon: bigint): number {
    return ticketsAffordable(legs, budgetTon);
  }

  /**
   * Shared scaffolding for all `quoteXxxBet` methods: resolves common params
   * (priceCoins + addresses), runs the mode-specific tx-sdk call, and registers
   * the produced `BetQuote` in `paramsByQuote` so `confirmQuote(quote)` can
   * auto-recover the original params.
   */
  private async runQuote<P extends QuoteCommon>(
    params: P,
    build: (common: CommonBetParams) => Promise<BetQuote>,
  ): Promise<BetQuote> {
    const common = await this.buildCommon(params);
    const quote = await build(common);
    this.paramsByQuote.set(quote, params);
    return quote;
  }

  /**
   * Re-simulate the swap and rebuild the tx just before signing.
   * **Mandatory** before any send — catches slippage drift and rebuilds the tx
   * at the current rate. Returns both raw `txs` and TonConnect `messages` so
   * the caller doesn't need a separate conversion step.
   *
   * `params` is optional: if `quote` was produced by one of this SDK's
   * `quoteXxxBet` calls, the original params are auto-retrieved (so a single
   * `confirmQuote(quote)` is enough). Pass `params` explicitly only when you
   * built `quote` manually with `tx-sdk`, or want to override the originals
   * (e.g. swap the beneficiary at the last second).
   */
  async confirmQuote(quote: BetQuote, params?: ConfirmQuoteParams): Promise<ConfirmedQuote> {
    const resolvedParams = params ?? this.paramsByQuote.get(quote);
    if (!resolvedParams) {
      throw new ToncastError(
        "confirmQuote needs the original quoteParams — pass them as the second arg, " +
          "or produce the quote via this SDK's quoteXxxBet so they're auto-tracked.",
        "QUOTE_PARAMS_MISSING",
      );
    }
    if (resolvedParams.financialRiskAcknowledged !== true) {
      throw new ToncastError(
        "confirmQuote requires financialRiskAcknowledged: true before returning signable transactions.",
        "FINANCIAL_RISK_ACK_REQUIRED",
      );
    }
    const { beneficiary, senderAddress, referral, referralPct } = this.resolveAddresses(
      resolvedParams,
      "confirmQuote",
    );
    // Drop SDK-side preview snapshots — the user is about to sign, so every
    // simulation between here and the signed tx must hit the real API. tx-sdk
    // also clears its own RatesClient inside `confirmQuote`; this is the
    // outer layer of the same belt-and-suspenders defence.
    this.cachedApi?.clear();
    const fresh = await this.getTxSdk().confirmQuote(quote, {
      pariAddress: parseTonAddress(resolvedParams.pariId, "pariId"),
      beneficiary,
      senderAddress,
      referral,
      referralPct,
    });
    assertQuoteSendable(fresh, "confirmQuote");
    return {
      quote: fresh,
      txs: fresh.option.txs,
      messages: fresh.option.txs.map(toTonConnectMessage),
    };
  }

  /**
   * Per-coin / per-mode budget summary for a UI to show "min/max" sliders.
   * Reads pari + oddsState + balances + priceCoins in parallel. Resolves
   * with the **fully-priced** snapshot (TON + every viable jetton).
   *
   * On a cold load this can take 3-8 s because STON.fi's `/v1/markets`
   * (~4 MB) must be fetched before jetton routes can be priced. For UIs
   * that want to render sooner, use {@link subscribeSummary} — it emits
   * a TON-only summary first (instant) then the full one when ready.
   */
  async summary(pariId: string, opts: PriceCoinsOptions = {}): Promise<BetSummary> {
    const [pari, oddsState, pricedCoins] = await Promise.all([
      this.deps.paris.get(pariId),
      this.deps.paris.getOddsState(pariId),
      this.priceCoins(opts),
    ]);
    return this.buildSummary(pari, oddsState, pricedCoins, opts);
  }

  /**
   * Streaming version of {@link summary}: emits **twice**.
   *
   * 1. Fast (~200 ms): pari + oddsState + `pricedCoins` containing **only
   *    TON** (instant, no swap routing). Wallet jettons are surfaced via
   *    {@link BetSummary.loadingCoins} so the UI can render them as
   *    "loading" placeholders without confusing the quote engine
   *    (placeholder PricedCoin entries can break tx-sdk's internal
   *    validation, so we keep them out of `pricedCoins` entirely).
   * 2. Full: `pricedCoins` is now fully resolved through STON.fi swap
   *    routing; `loadingCoins` becomes empty. Arrives once the markets
   *    snapshot is in the cache (cold: 3-8 s, warm: instant).
   *
   * Implements `Subscribable<BetSummary>` so `useObservableQuery` in the
   * React layer drops it straight in — no extra glue.
   */
  subscribeSummary(pariId: string, opts: PriceCoinsOptions = {}): ToncastObservable<BetSummary> {
    return new ToncastObservable<BetSummary>((observer) => {
      let cancelled = false;

      // Phase 1 — pari + oddsState + raw balances. TON-only pricing is
      // synthesized from the wallet balance (no swap routing needed).
      void Promise.all([
        this.deps.paris.get(pariId),
        this.deps.paris.getOddsState(pariId),
        this.deps.coins.list(),
      ])
        .then(([pari, oddsState, allCoins]) => {
          if (cancelled) return;
          const tonOnlyPriced = synthesizeTonOnlyPricedCoins(allCoins, opts.walletReserve);
          // Jettons exist in the wallet but their TON value is unknown until
          // STON.fi markets resolve — surface them via `loadingCoins` so the
          // UI can render them as "loading" without confusing the quote engine.
          const loadingJettons = allCoins.filter((c) => c.address !== TON_ADDRESS);
          observer.next?.(this.buildSummary(pari, oddsState, tonOnlyPriced, opts, loadingJettons));
          // Phase 2 — full priceCoins with STON.fi swap routing for jettons.
          // Re-uses `allCoins` to avoid a second balance round-trip.
          return this.priceCoins({ ...opts, availableCoins: allCoins }).then((fullPriced) => {
            if (cancelled) return;
            observer.next?.(this.buildSummary(pari, oddsState, fullPriced, opts));
            observer.complete?.();
          });
        })
        .catch((err) => {
          if (!cancelled) observer.error?.(err instanceof Error ? err : new Error(String(err)));
        });

      return () => {
        cancelled = true;
      };
    });
  }

  /** Build a `BetSummary` from already-resolved pari/oddsState/pricedCoins. */
  private buildSummary(
    pari: Pari,
    oddsState: OddsState,
    pricedCoins: PricedCoin[],
    opts: PriceCoinsOptions,
    loadingCoins: AvailableCoin[] = [],
  ): BetSummary {
    const walletReserve = opts.walletReserve ?? DEFAULT_WALLET_RESERVE;
    // Smallest single-ticket bet: yesOdds=2, isYes=true → 0.02 TON ticket + 0.1 TON Pari fee.
    const minBetTon = ticketCost(2, true) + PARI_EXECUTION_FEE;
    const capacities: CoinCapacity[] = pricedCoins.map((coin) => {
      const source: AvailableCoin = {
        address: coin.address,
        amount: coin.amount,
      };
      if (coin.symbol !== undefined) source.symbol = coin.symbol;
      if (coin.decimals !== undefined) source.decimals = coin.decimals;
      return {
        source,
        feasible: coin.viable,
        reason: coin.reason,
        minBetTon,
        maxBetTon: coin.viable ? availableForBet(coin, walletReserve) : 0n,
        route: coin.route,
      };
    });
    return {
      pari,
      oddsState,
      pricedCoins,
      capacities,
      minBetTon,
      perBetExecutionFeeTon: PARI_EXECUTION_FEE,
      marketYes: computeMarketCapacity(oddsState, true),
      marketNo: computeMarketCapacity(oddsState, false),
      loadingCoins,
    };
  }

  /**
   * Resolves common bet params, auto-fetching `pricedCoins` when omitted.
   * `priceCoins()` reads the user's actual balances via `tonClient` —
   * without it the SDK can't validate that the bet is affordable.
   *
   * Why mandatory: a "feasible" quote without a balance check would lie —
   * the wallet would reject the signed tx for insufficient funds, surfacing
   * the failure too late in the UX. Integrators that genuinely don't want a
   * balance check (e.g. server-side tx-builder with funds guaranteed elsewhere)
   * should bypass `BettingResource` entirely and call `computeXxxBets` +
   * `buildTonBetTx` / `buildJettonBetTx` directly — both are re-exported from
   * `@toncast/sdk` for exactly this case.
   */
  private async buildCommon(params: QuoteCommon): Promise<CommonBetParams> {
    const { beneficiary, senderAddress, referral, referralPct } = this.resolveAddresses(
      params,
      "quote",
    );
    const pricedCoins =
      params.pricedCoins ??
      (await this.priceCoins({
        ...(params.slippage !== undefined ? { slippage: params.slippage } : {}),
      }));
    return {
      pariAddress: parseTonAddress(params.pariId, "pariId"),
      beneficiary,
      senderAddress,
      isYes: params.isYes,
      referral,
      referralPct,
      source: params.source,
      pricedCoins,
      ...(params.slippage !== undefined ? { slippage: params.slippage } : {}),
      ...(params.walletReserve !== undefined ? { walletReserve: params.walletReserve } : {}),
      ...(params.allowInsufficientBalance !== undefined
        ? { allowInsufficientBalance: params.allowInsufficientBalance }
        : {}),
    };
  }

  /**
   * Resolves the three addresses for any bet:
   * - **signer** (`senderAddress`) — TonConnect-bound wallet that funds & signs.
   *   Defaults to `client.userAddress`.
   * - **beneficiary** — wallet that owns the resulting tickets / receives payout.
   *   Defaults to the signer (= self-bet).
   * - **referral** — optional 3rd party that earns `referralPct` of winnings.
   *   Defaults to the SDK-level `referral` option set on `ToncastClient`.
   *   Per-call params override the default; `referral: null` explicitly disables.
   *
   * For jetton-funded bets, `senderAddress` is critical: STON.fi derives the
   * jetton-wallet to pull from based on it. Defaulting senderAddress to the
   * beneficiary (as tx-sdk does) would route through the recipient's jetton
   * wallet — which the signer can't authorise. We always anchor senderAddress
   * to the connected wallet, then let beneficiary float.
   */
  private resolveAddresses(
    params: QuoteCommon,
    method: string,
  ): {
    beneficiary: string;
    senderAddress: string;
    referral: string | null;
    referralPct: number;
  } {
    const signer = parseTonAddress(
      params.senderAddress ?? this.requireUserAddress(method),
      "senderAddress",
    );
    const beneficiary = parseTonAddress(params.beneficiary ?? signer, "beneficiary");

    // Per-call referral wins (including explicit `referral: null`); else fall
    // back to the SDK-level default.
    const explicitReferral = params.referral !== undefined || params.referralPct !== undefined;
    const fallback = explicitReferral ? undefined : this.deps.getReferral();
    const referralRaw = explicitReferral ? (params.referral ?? null) : (fallback?.address ?? null);
    const referral = referralRaw ? parseTonAddress(referralRaw, "referral") : null;
    const referralPct = explicitReferral ? (params.referralPct ?? 0) : (fallback?.pct ?? 0);

    return { senderAddress: signer, beneficiary, referral, referralPct };
  }

  private requireUserAddress(method: string): string {
    const addr = this.deps.getUserAddress();
    if (!addr) {
      throw new ToncastError(
        `${method} requires senderAddress or a default userAddress — pass it explicitly or set client.setUserAddress(addr).`,
        "USER_ADDRESS_REQUIRED",
      );
    }
    return addr;
  }
}

/**
 * Convert a single tx-sdk `TxParams` to a TonConnect-shaped message.
 * Useful when you build quotes manually and need to hand them to TonConnect
 * without going through the standard `quoteXxx → confirmQuote` flow.
 */
export function toTonConnectMessage(tx: TxParams): TonConnectMessage {
  const message: TonConnectMessage = {
    address: tx.to.toString(),
    amount: tx.value.toString(),
  };
  if (tx.body) message.payload = tx.body.toBoc().toString("base64");
  return message;
}

/**
 * Convert all transactions from a confirmed `BetQuote` into TonConnect messages.
 * Throws if the quote is infeasible or hasn't been confirmed yet (jetton sources
 * need `confirmQuote` first).
 */
export function toTonConnectMessages(quote: BetQuote): TonConnectMessage[] {
  assertQuoteSendable(quote, "toTonConnectMessages");
  return quote.option.txs.map(toTonConnectMessage);
}

/**
 * Throws if the quote is infeasible or unsignable — the same gate every
 * "publish this quote" path needs. `where` is included in the error message
 * for easier debugging (`confirmQuote` vs `toTonConnectMessages`).
 *
 * `asserts`-typed so callers downstream see a narrowed `BetQuote` with
 * `option.feasible === true` + `option.txs` available.
 */
function assertQuoteSendable(
  quote: BetQuote,
  where: string,
): asserts quote is BetQuote & { option: { feasible: true; estimated: false; txs: TxParams[] } } {
  if (!quote.option.feasible) {
    throw new ToncastError(
      `${where}: quote is infeasible — ${quote.option.reason}`,
      "QUOTE_INFEASIBLE",
    );
  }
  if (quote.option.estimated || quote.option.txs.length === 0) {
    throw new ToncastError(
      `${where}: quote has no transactions to sign — call confirmQuote() first for jetton sources.`,
      "QUOTE_NOT_READY",
    );
  }
}

/** Helper re-export so callers don't need to import tx-sdk directly. */
export { TON_ADDRESS };

/**
 * `true` iff `addr` represents native TON. Compares case-insensitively
 * against the canonical placeholder `EQAA…AM9c`. Tx-sdk has its own
 * `sameAddress` for general-purpose comparisons but it isn't exported
 * from the top-level entry; this single-target check avoids the
 * subpath-import gymnastics.
 */
function isTonAddress(addr: string): boolean {
  return addr.toLowerCase() === TON_ADDRESS.toLowerCase();
}

function getNodeEnv(): string | undefined {
  const proc =
    typeof globalThis === "undefined"
      ? undefined
      : (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  return proc?.env?.NODE_ENV;
}

/**
 * Walk the order book in cheapest-first order for the given side, building
 * the per-bucket breakdown the slider / capacity helpers consume.
 *
 * For a YES bet we match against NO offers across yesOdds = 2..98 (cheapest
 * for the bettor at low yesOdds, since the YES ticket costs `yesOdds/100`).
 * For a NO bet we walk the same yesOdds range but `availableTickets`
 * already maps to the NO-side ladder per tx-sdk's complementary indexing.
 * Buckets with zero liquidity are skipped.
 */
function computeMarketCapacity(oddsState: OddsState, isYes: boolean): MarketCapacity {
  const legs: MarketCapacity["legs"] = [];
  let maxTickets = 0;
  // Walk ascending yesOdds for YES bets (lowest cost first), descending for
  // NO bets — same direction `computeMarketBets` uses internally.
  const start = isYes ? ODDS_MIN : ODDS_MAX;
  const step = isYes ? ODDS_STEP : -ODDS_STEP;
  const inRange = (o: number) => (isYes ? o <= ODDS_MAX : o >= ODDS_MIN);
  for (let yesOdds = start; inRange(yesOdds); yesOdds += step) {
    const available = availableTickets(oddsState, isYes, yesOdds);
    if (available <= 0) continue;
    const price = ticketCost(yesOdds, isYes);
    if (price <= 0n) continue;
    legs.push({ yesOdds, available, ticketCostTon: price });
    maxTickets += available;
  }
  // `affordableTickets` defaults to the raw book depth — `marketCapacity`
  // tightens it when given a budget.
  return { maxTickets, affordableTickets: maxTickets, legs };
}

/**
 * Sum the TON cost of taking the first N tickets out of `legs` greedily,
 * including one `PARI_EXECUTION_FEE` per touched bucket (each bucket
 * becomes a separate `BetItem` on-chain, each carrying its own fee).
 *
 * Caller MUST ensure `n <= sum(legs.available)`; we cap defensively.
 */
function budgetForFirstNTickets(legs: MarketCapacity["legs"], n: number): bigint {
  let remaining = BigInt(n);
  let budget = 0n;
  for (const leg of legs) {
    if (remaining <= 0n) break;
    const take = remaining < BigInt(leg.available) ? remaining : BigInt(leg.available);
    budget += take * leg.ticketCostTon + PARI_EXECUTION_FEE;
    remaining -= take;
  }
  return budget;
}

/**
 * Maximum number of tickets a budget can fund greedily.
 *
 * Walks `legs` from cheapest, billing one `PARI_EXECUTION_FEE` per touched
 * bucket. After matched liquidity is exhausted, any leftover budget gets
 * spent on a "placement" leg at `legs[0].yesOdds` (the cheapest matched
 * price — same yesOdds tx-sdk's `computeMarketBets` uses for its leftover
 * placement). That mirrors what the wallet actually pays for if the user
 * dials past the order book's matched depth.
 */
function ticketsAffordable(legs: MarketCapacity["legs"], maxBudgetTon: bigint): number {
  let remaining = maxBudgetTon;
  let total = 0;
  let lastTouchedLeg: MarketCapacity["legs"][number] | null = null;
  let allLegsFullyMatched = true;
  for (const leg of legs) {
    if (remaining <= PARI_EXECUTION_FEE) {
      allLegsFullyMatched = false;
      break;
    }
    const afterFee = remaining - PARI_EXECUTION_FEE;
    const ticketsByBudget = afterFee / leg.ticketCostTon;
    if (ticketsByBudget <= 0n) {
      allLegsFullyMatched = false;
      break;
    }
    const take = ticketsByBudget < BigInt(leg.available) ? Number(ticketsByBudget) : leg.available;
    if (take <= 0) {
      allLegsFullyMatched = false;
      break;
    }
    total += take;
    remaining -= PARI_EXECUTION_FEE + leg.ticketCostTon * BigInt(take);
    lastTouchedLeg = leg;
    if (take < leg.available) {
      allLegsFullyMatched = false;
      break;
    }
  }

  // Matched everything in the book and budget left over — those overflow
  // tickets become a placement leg at the cheapest matched price. tx-sdk
  // merges placement into the existing entry on `legs[0].yesOdds` (no extra
  // execution fee), so the leftover budget converts 1:1 to extra tickets.
  if (allLegsFullyMatched && lastTouchedLeg && legs[0] && remaining > 0n) {
    const placePrice = legs[0].ticketCostTon;
    if (placePrice > 0n) total += Number(remaining / placePrice);
  }
  return total;
}
