// Cached `StonApiClient` for *preview-only* swap simulations.
//
// Why this exists: tx-sdk caches a `simulateSwap(...)` response by the EXACT
// `(offer, ask, units, slippage, direction)` tuple. Every Toncast pari has a
// different `totalCost` (depends on `oddsState` + `maxBudgetTon` + `ticketCost`),
// so opening a different pari's bet card always misses the cache and fires a
// fresh `simulate?` call to STON.fi. With many pari in a feed, that adds up
// fast.
//
// Trick: the AMM curve is approximately linear in the SMALL-amount regime
// where typical Toncast bets live (relative to USDT/TON pool depth). We can
// take ONE real `simulateSwap` snapshot per `(offer, ask, slippage, direction)`
// pair and locally extrapolate `offerUnits ↔ askUnits ↔ minAskUnits ↔ feeUnits`
// for any subsequent `units` — ~zero error for normal bet sizes, big saving
// in network round-trips.
//
// SAFETY GUARANTEES:
//
//  1. **Confirm-time fresh**: `BettingResource.confirmQuote()` calls
//     `cachedApi.clear()` BEFORE forwarding to `txSdk.confirmQuote()`, which
//     itself does another `clearRateCache()` internally. Net effect: every
//     pre-signing simulation hits the real API. The user always signs against
//     a current rate; SLIPPAGE_DRIFTED in tx-sdk fires if the rate moved
//     beyond `slippage` between preview and confirm.
//
//  2. **Short TTL**: synthetic responses expire after `ttlMs` (default 30 s)
//     so a stale snapshot can't survive a long-idle modal.
//
//  3. **Linearity bound**: extrapolation factor capped at 10x. Beyond that
//     we fall back to a real call — beyond ~10x the original probe size the
//     AMM curve diverges enough that linear is misleading.
//
//  4. **Untouched fields**: `gasParams`, addresses, `swapRate`, slippage
//     fields are copied verbatim from the snapshot. We only touch the
//     unit-proportional fields. `priceImpact` is kept as-is (preview indicates
//     "small impact"; the real impact at confirm time will be authoritative).

import { StonApiClient } from "@ston-fi/api";
import { Address } from "@ton/ton";

type SimulateParams = Parameters<StonApiClient["simulateSwap"]>[0];
type SimulateReverseParams = Parameters<StonApiClient["simulateReverseSwap"]>[0];
type SwapSimulation = Awaited<ReturnType<StonApiClient["simulateSwap"]>>;

interface Snapshot {
  result: SwapSimulation;
  /** Real `units` value the snapshot was fetched with — anchor for extrapolation. */
  units: bigint;
  /** Direction the snapshot represents — forward / reverse. */
  direction: "forward" | "reverse";
  fetchedAt: number;
}

const DEFAULT_TTL_MS = 30_000;
const MAX_EXTRAPOLATION_FACTOR = 10;

/**
 * Decorator over `StonApiClient` that memoises ONE real `simulateSwap` /
 * `simulateReverseSwap` result per `(offer, ask, slippage, dexVersion)`
 * tuple and synthesises subsequent calls by linearly extrapolating the
 * unit-proportional fields. Expired (or out-of-range) entries fall through
 * to a real network call.
 */
export class CachedStonApiClient extends StonApiClient {
  private readonly snapshots = new Map<string, Snapshot>();

  constructor(
    options?: ConstructorParameters<typeof StonApiClient>[0],
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    /**
     * Optional debug callback fired on every simulate decision (hit / miss /
     * out-of-bounds). Wire to `console.debug` while diagnosing why the cache
     * isn't sticking — leave undefined in production for zero overhead.
     */
    private readonly onDecision?: (event: {
      action: "hit" | "miss" | "miss-ttl" | "miss-bounds" | "miss-direction";
      key: string;
      requestedUnits: bigint;
      anchorUnits?: bigint;
    }) => void,
  ) {
    super(options);
  }

  override async simulateSwap(query: SimulateParams): Promise<SwapSimulation> {
    const key = makeKey({
      offer: query.offerAddress,
      ask: query.askAddress,
      slippage: query.slippageTolerance,
      dexV2: query.dexV2,
      dexVersion: query.dexVersion,
      direction: "forward",
    });
    const units = BigInt(query.offerUnits);
    const synthesised = this.trySynthesise(key, units, "forward");
    if (synthesised) return synthesised;

    const result = await super.simulateSwap(query);
    this.snapshots.set(key, {
      result,
      units,
      direction: "forward",
      fetchedAt: Date.now(),
    });
    return result;
  }

  override async simulateReverseSwap(query: SimulateReverseParams): Promise<SwapSimulation> {
    const key = makeKey({
      offer: query.offerAddress,
      ask: query.askAddress,
      slippage: query.slippageTolerance,
      dexV2: query.dexV2,
      dexVersion: query.dexVersion,
      direction: "reverse",
    });
    const units = BigInt(query.askUnits);
    const synthesised = this.trySynthesise(key, units, "reverse");
    if (synthesised) return synthesised;

    const result = await super.simulateReverseSwap(query);
    this.snapshots.set(key, {
      result,
      units,
      direction: "reverse",
      fetchedAt: Date.now(),
    });
    return result;
  }

  /** Drop every snapshot — call right before any user-facing commit so the
   * subsequent `simulateSwap` / `simulateReverseSwap` go to the real API. */
  clear(): void {
    this.snapshots.clear();
  }

  private trySynthesise(
    key: string,
    units: bigint,
    direction: "forward" | "reverse",
  ): SwapSimulation | null {
    const snap = this.snapshots.get(key);
    if (!snap) {
      this.onDecision?.({ action: "miss", key, requestedUnits: units });
      return null;
    }
    if (snap.direction !== direction) {
      this.onDecision?.({
        action: "miss-direction",
        key,
        requestedUnits: units,
        anchorUnits: snap.units,
      });
      return null;
    }
    if (Date.now() - snap.fetchedAt > this.ttlMs) {
      this.snapshots.delete(key);
      this.onDecision?.({
        action: "miss-ttl",
        key,
        requestedUnits: units,
        anchorUnits: snap.units,
      });
      return null;
    }
    if (snap.units === 0n) {
      this.onDecision?.({
        action: "miss-bounds",
        key,
        requestedUnits: units,
        anchorUnits: snap.units,
      });
      return null;
    }

    // Bound the extrapolation factor — both UP (don't trust linearity for
    // amounts much bigger than the probe) and DOWN (rounding to int strings
    // collapses tiny amounts to 0, which would build a broken response).
    const ratioUp = (units * 100n) / snap.units;
    if (ratioUp > BigInt(MAX_EXTRAPOLATION_FACTOR * 100)) {
      this.onDecision?.({
        action: "miss-bounds",
        key,
        requestedUnits: units,
        anchorUnits: snap.units,
      });
      return null;
    }
    if (ratioUp < 1n) {
      this.onDecision?.({
        action: "miss-bounds",
        key,
        requestedUnits: units,
        anchorUnits: snap.units,
      });
      return null;
    }

    this.onDecision?.({
      action: "hit",
      key,
      requestedUnits: units,
      anchorUnits: snap.units,
    });
    return scaleSnapshot(snap, units, direction);
  }
}

/**
 * Stable cache key for a swap simulation request. Includes everything that
 * affects which pool path STON.fi picks; excludes `units` (we extrapolate
 * those) and `referralAddress`/`poolAddress` (orthogonal to the rate).
 *
 * Both addresses are normalised through `Address.parse().toString()` because
 * different callers in the chain feed us the same jetton in different forms:
 * `priceCoins` passes raw hex from toncenter (`0:B113A9…`), while tx-sdk's
 * cross-hop discovery passes `EQ…` from the STON.fi pairs index. Without
 * normalisation a USDT swap looks like two unrelated tokens and the cache
 * misses on every modal open.
 */
function makeKey(args: {
  offer: string;
  ask: string;
  slippage: string;
  dexV2?: boolean;
  dexVersion?: SimulateParams["dexVersion"];
  direction: "forward" | "reverse";
}): string {
  const v2 = args.dexV2 === false ? "0" : "1";
  const ver = args.dexVersion ? args.dexVersion.join(",") : "";
  return [
    args.direction,
    canonicaliseAddress(args.offer),
    canonicaliseAddress(args.ask),
    args.slippage,
    v2,
    ver,
  ].join("|");
}

function canonicaliseAddress(raw: string): string {
  try {
    return Address.parse(raw).toString();
  } catch {
    return raw;
  }
}

/** Linearly scale the unit-proportional fields of a `SwapSimulation`. */
function scaleSnapshot(
  snap: Snapshot,
  newUnits: bigint,
  direction: "forward" | "reverse",
): SwapSimulation {
  const { result, units: anchorUnits } = snap;
  // For forward, `newUnits` is offer; for reverse, `newUnits` is ask.
  // We always scale every monetary field by the same factor relative to the
  // anchor value of that side.
  const offerAnchor = BigInt(result.offerUnits);
  const askAnchor = BigInt(result.askUnits);
  const minAskAnchor = BigInt(result.minAskUnits);
  const recommendedMinAskAnchor = BigInt(result.recommendedMinAskUnits || result.minAskUnits);
  const feeAnchor = BigInt(result.feeUnits);

  const scaleNum = newUnits;
  const scaleDen = direction === "forward" ? anchorUnits : askAnchor;
  // Forward: scaleDen = offerUnits anchor; Reverse: scaleDen = askUnits anchor.
  // (For reverse, `newUnits` is ask, `anchorUnits` is also ask — they're equal
  //  by construction. Use askAnchor for clarity, same value.)

  if (scaleDen === 0n) {
    // Defensive — shouldn't happen with real API responses.
    return result;
  }

  const scaledOffer = (offerAnchor * scaleNum) / scaleDen;
  const scaledAsk = (askAnchor * scaleNum) / scaleDen;
  const scaledMinAsk = (minAskAnchor * scaleNum) / scaleDen;
  const scaledRecMinAsk = (recommendedMinAskAnchor * scaleNum) / scaleDen;
  const scaledFee = (feeAnchor * scaleNum) / scaleDen;

  return {
    ...result,
    offerUnits: scaledOffer.toString(),
    askUnits: scaledAsk.toString(),
    minAskUnits: scaledMinAsk.toString(),
    recommendedMinAskUnits: scaledRecMinAsk.toString(),
    feeUnits: scaledFee.toString(),
    // `priceImpact`, `swapRate`, `gasParams`, `slippageTolerance`,
    // `recommendedSlippageTolerance`, addresses — copied as-is. They're
    // either non-monetary or, in the case of priceImpact, an indicative
    // figure that the real confirm-time call will resimulate.
  };
}
