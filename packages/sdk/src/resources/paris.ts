import { z } from "zod";
import type { Logger } from "../client/config";
import { ToncastApiError, ToncastError } from "../errors";
import { Endpoints } from "../http/endpoints";
import type { HttpClient } from "../http/HttpClient";
import type { SupportedLanguage } from "../i18n/languages";
import {
  type CoefficientHistory,
  CoefficientHistorySchema,
  type CoefficientHistoryTimeframe,
} from "../types/coefficient-history";
import { type OddsState, OddsStateResponseSchema } from "../types/odds-state";
import { type Pari, PariSchema } from "../types/pari";
import { type PariWinner, PariWinnerSchema } from "../types/winner";
import { type Cursor, envelopeSchema, iteratePages, type Page } from "../utils/pagination";
import {
  type PariStream,
  PariStream as PariStreamImpl,
  type SubscribePariParams,
} from "./pari-stream";
import { ParisListSocket } from "./paris-list-socket";
import { ParisListStream, type StreamListParams } from "./paris-stream";

/** Cursor shape returned by `/v1/paris`. Re-exported for typed callers. */
export interface ParisCursor {
  sortValue: number;
  address: string;
}

/**
 * Which slice of paris to return. Each value is mutually exclusive
 * (the backend feeds don't overlap):
 * - "active"   — open paris (default). Backend: no extra flags.
 * - "finished" — already resolved (`status: "inactive"`, `result: "yes" | "no" | "draw"`).
 *                Backend: `?includeInactive=true`.
 * - "pending"  — past `endTime` but the oracle hasn't pushed a result yet
 *                (so `status` is still `"active"` and `result` is still `"pending"`).
 *                Backend: `?showPendingResults=true`.
 */
export type ParisFeed = "active" | "finished" | "pending";

/** All valid feed identifiers in display order. */
export const PARIS_FEEDS = ["active", "pending", "finished"] as const satisfies readonly ParisFeed[];

export interface ListParisParams {
  /** Return resolved paris. Equivalent to `?includeInactive=true`. */
  includeInactive?: boolean;
  /** Return paris past `endTime` but not yet resolved. Equivalent to `?showPendingResults=true`. */
  showPendingResults?: boolean;
  /** Filter by category id (see `client.categories.list()`). */
  categoryId?: number;
  /** Free-text search query, ≤ 100 characters. */
  search?: string;
  /** Page size. Default 20, max 50 (enforced by backend). */
  limit?: number;
  /**
   * Opaque cursor returned in the previous `Page.nextCursor`. Pass through unchanged.
   * The resource splits the `{sortValue, address}` shape into the
   * `cursorSortValue` / `cursorAddress` query params expected by the API.
   */
  cursor?: Cursor | null;
  signal?: AbortSignal;
}

export interface CoefficientHistoryParams {
  /** Number of points to return. Default 100 (per backend). */
  limit?: number;
  /** Time window. Default `"ALL"`. */
  timeframe?: CoefficientHistoryTimeframe;
  signal?: AbortSignal;
}

const ParisPageSchema = envelopeSchema(PariSchema);
const PariWinnersSchema = z.array(PariWinnerSchema);

export interface ParisResourceDeps {
  http: HttpClient;
  wsBaseUrl: string;
  getLanguage: () => SupportedLanguage;
  logger: Logger;
}

/**
 * Read-only paris (prediction markets) resource.
 * Backed by `/v1/paris`, `/v1/paris/:id`, and three sub-resources:
 * `odds-state`, `coefficient-history`, `winners`.
 *
 * Real-time:
 * - `streamList(...)` — at most ONE active list-stream per client (a new call
 *   auto-stops the previous one — keeps a single WS open to `/ws/pari-list`).
 * - `subscribe(pariId)` — at most ONE active per-pari stream per client. A new
 *   `subscribe(otherPariId)` (or even the same id) auto-stops the previous one.
 * - The two are independent: a list-stream and a per-pari stream coexist.
 *
 * The cap protects Cloudflare Durable Objects from connection storms and lets
 * integrators rotate views without manual book-keeping.
 */
export class ParisResource {
  private readonly http: HttpClient;
  /**
   * Stream pool keyed by canonical params. Streams stay warm across re-subscribes,
   * route changes, category toggles, etc. Each stream auto-stops itself after a
   * short idle window (no active `subscribe()` consumers) and is then evicted.
   * That gives instant re-show for recent params without leaking idle WSs forever.
   */
  private readonly listStreams = new Map<string, ParisListStream>();
  /** Same pooling for per-pari streams, keyed by `pariId|paramsKey`. */
  private readonly pariStreams = new Map<string, PariStream>();
  /**
   * Single shared `wss://…/ws/pari-list` connection multiplexed across every
   * `streamList(...)` consumer. The backend channel is one global broadcast
   * room — opening per-filter sockets duplicated traffic and made every
   * category toggle re-handshake a fresh WS.
   */
  private readonly listSocket: ParisListSocket;

  constructor(private readonly deps: ParisResourceDeps) {
    this.http = deps.http;
    this.listSocket = new ParisListSocket({
      wsBaseUrl: deps.wsBaseUrl,
      logger: deps.logger,
    });
  }

  async list(params: ListParisParams = {}): Promise<Page<Pari>> {
    // /v1/paris always returns object cursors. Reject string cursors with a clear
    // error instead of silently dropping them and serving page 1 again.
    if (typeof params.cursor === "string") {
      throw new ToncastError(
        "paris.list expects an object cursor (`{sortValue, address}`), got a string. " +
          "Pass `Page.nextCursor` from a previous paris.list() call unchanged.",
        "INVALID_CURSOR",
      );
    }
    const cursor = params.cursor as ParisCursor | null | undefined;
    const page = await this.http.request({
      path: Endpoints.paris.list,
      query: {
        categoryId: params.categoryId,
        search: params.search,
        includeInactive: params.includeInactive || undefined,
        showPendingResults: params.showPendingResults || undefined,
        limit: params.limit,
        cursorSortValue: cursor?.sortValue,
        cursorAddress: cursor?.address,
      },
      schema: ParisPageSchema,
      signal: params.signal,
    });
    return { ...page, items: page.items.filter(isPariVisible) };
  }

  /** Fetch a single pari by its on-chain address. */
  async get(id: string, signal?: AbortSignal): Promise<Pari> {
    const pari = await this.http.request({
      path: Endpoints.paris.byId(id),
      schema: PariSchema,
      signal,
    });
    if (!isPariVisible(pari)) {
      throw new ToncastApiError(`Pari ${id} not found`, 404, Endpoints.paris.byId(id));
    }
    return pari;
  }

  /**
   * Current order book snapshot. The shape is bit-compatible with the
   * `OddsState` from `@toncast/tx-sdk` — pass straight to `quoteLimitBet` /
   * `quoteMarketBet`.
   */
  async getOddsState(id: string, signal?: AbortSignal): Promise<OddsState> {
    return this.http.request({
      path: Endpoints.paris.oddsState(id),
      schema: OddsStateResponseSchema,
      signal,
    });
  }

  /** Time series of YES coefficient (yesOdds) changes. */
  async getCoefficientHistory(
    id: string,
    params: CoefficientHistoryParams = {},
  ): Promise<CoefficientHistory> {
    return this.http.request({
      path: Endpoints.paris.coefficientHistory(id),
      query: { limit: params.limit, timeframe: params.timeframe },
      schema: CoefficientHistorySchema,
      signal: params.signal,
    });
  }

  /** List of winners for a resolved pari. Empty until the pari is resolved. */
  async getWinners(id: string, signal?: AbortSignal): Promise<PariWinner[]> {
    return this.http.request({
      path: Endpoints.paris.winners(id),
      schema: PariWinnersSchema,
      signal,
    });
  }

  /** Lazy iterator over every page of `list()`. Stops when `signal` aborts. */
  iterate(params: ListParisParams = {}): AsyncGenerator<Pari> {
    return iteratePages((cursor) => this.list({ ...params, cursor }), params.signal);
  }

  /**
   * Live, paginated, self-managing list of paris. Returns immediately;
   * the initial fetch + WS subscription happen in the background.
   *
   * The integrator only sees `Pari[]` snapshots — the SDK handles cursor
   * tracking, sequenceId dedup, gap recovery, ping/pong watchdog, reconnect,
   * polling fallback, and `pari_created` localization (via `client.language`).
   *
   * **Pooled by params**: calling `streamList(p)` twice with the same `p`
   * returns the SAME stream object — no duplicate fetch, no extra socket
   * traffic. Streams live for the lifetime of the `ToncastClient`; each one
   * is just an in-memory `Pari[]` snapshot kept fresh by the shared
   * `/ws/pari-list` connection. To free a stream early call `.stop()` — the
   * pool then forgets it on the next `streamList(sameParams)` call.
   *
   * Note: when `search` is set, polling is used instead of WS — the broadcast
   * stream doesn't carry search-filtered events.
   */
  streamList(params: StreamListParams = {}): ParisListStream {
    const key = streamKey(params);
    const existing = this.listStreams.get(key);
    if (existing && !existing.isStopped()) return existing;
    const stream = new ParisListStream(
      {
        paris: this,
        socket: this.listSocket,
        getLanguage: this.deps.getLanguage,
        logger: this.deps.logger,
      },
      params,
    );
    this.listStreams.set(key, stream);
    return stream;
  }

  /**
   * Force every active list-stream and per-pari subscription to refetch its
   * REST snapshot. Used by `ToncastClient.setLanguage()` so existing stream
   * consumers see freshly-localised data without re-subscribing.
   */
  refetchAllStreams(): void {
    for (const s of this.listStreams.values()) {
      if (!s.isStopped()) void s.refresh();
    }
    for (const s of this.pariStreams.values()) {
      if (!s.isStopped()) void s.refresh();
    }
  }

  /**
   * Live, self-managing view of a single pari. Returns immediately; initial
   * `paris.get` + `getOddsState` + `getCoefficientHistory` run in parallel,
   * then the per-pari WS connects and pushes incremental updates.
   *
   * **Pooled by `pariId + params`**: re-subscribing to the same target returns
   * the same stream — zero duplicate fetch, zero extra WS. Streams live for
   * the lifetime of the `ToncastClient`; call `.stop()` explicitly to release.
   *
   * Subscribe to whichever channels you need: `onPari`, `onOddsState`,
   * `onCoefficientHistory`, `onBetEvent`, `onStatus`. Stop with `.stop()`.
   *
   * `comment_added` broadcasts are silently ignored — comments will be
   * exposed in a later iteration.
   */
  subscribe(pariId: string, params: SubscribePariParams = {}): PariStream {
    const key = `${pariId}|${streamKey(params)}`;
    const existing = this.pariStreams.get(key);
    if (existing && !existing.isStopped()) return existing;
    const stream = new PariStreamImpl(
      {
        paris: this,
        wsBaseUrl: this.deps.wsBaseUrl,
        logger: this.deps.logger,
      },
      pariId,
      params,
    );
    this.pariStreams.set(key, stream);
    return stream;
  }
}

// Stable serialization for stream params — undefined keys are dropped, key
// order is normalised. Good enough for the small/flat params shapes we have
// (no nested objects, no Dates, no Maps).
function streamKey(params: object): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/** Hidden paris are filtered everywhere — never exposed to integrators or end-users. */
function isPariVisible(pari: Pari): boolean {
  return pari.isVisible;
}
