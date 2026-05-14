import { ToncastError } from "../errors";
import { Endpoints } from "../http/endpoints";
import type { HttpClient } from "../http/HttpClient";
import { type Bet, BetSchema } from "../types/bet";
import { type Cursor, envelopeSchema, iteratePages, type Page } from "../utils/pagination";

const BetsPageSchema = envelopeSchema(BetSchema);

/** Cursor shape returned by `/v1/bets/{pariAddress}/user/{userAddress}`. */
export interface BetsCursor {
  createdAt: number;
  id: number;
}

export interface BetsResourceDeps {
  http: HttpClient;
  getUserAddress: () => string | undefined;
}

export interface ListForPariByUserParams {
  pariId: string;
  /** Defaults to the SDK's `userAddress`. */
  userAddress?: string | undefined;
  /** Backend default 20. */
  pageSize?: number | undefined;
  /** Opaque cursor — JSON-encoded into the `cursor` query param. */
  cursor?: Cursor | null | undefined;
  signal?: AbortSignal | undefined;
}

export interface ListForUserParams {
  /** Defaults to the SDK's `userAddress`. */
  userAddress?: string | undefined;
  /** Backend default 20. */
  pageSize?: number | undefined;
  /** Opaque cursor — JSON-encoded into the `cursor` query param. */
  cursor?: Cursor | null | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * Read-only bets resource. Two endpoints:
 *  - `listForPariByUser` — bets a specific user placed on one pari
 *  - `listForUser`       — every bet a specific user placed across all paris
 *
 * Both default the `userAddress` to the SDK-level value (set on
 * `ToncastClient` or via `client.setUserAddress`); pass `userAddress`
 * explicitly to read someone else's public bet history.
 *
 * Cursor-paginated. Use `iterateForXxx` for the lazy `for await` form.
 */
export class BetsResource {
  constructor(private readonly deps: BetsResourceDeps) {}

  /**
   * Bets placed by `userAddress` on a specific pari.
   * Backed by `GET /v1/bets/{pariAddress}/user/{userAddress}`.
   */
  async listForPariByUser(params: ListForPariByUserParams): Promise<Page<Bet>> {
    const addr = params.userAddress ?? this.deps.getUserAddress();
    if (!addr) throw userAddressRequired("listForPariByUser");
    return this.deps.http.request({
      path: Endpoints.bets.forPariByUser(params.pariId, addr),
      query: {
        pageSize: params.pageSize,
        cursor: params.cursor ?? undefined,
      },
      schema: BetsPageSchema,
      signal: params.signal,
    });
  }

  /** Lazy iterator over every page of `listForPariByUser`. Stops when `signal` aborts. */
  iterateForPariByUser(params: Omit<ListForPariByUserParams, "cursor">): AsyncGenerator<Bet> {
    return iteratePages((cursor) => this.listForPariByUser({ ...params, cursor }), params.signal);
  }

  /**
   * All bets placed by `userAddress` across every pari (cursor-paginated).
   * Backed by `GET /v1/bets/user/{userAddress}`.
   */
  async listForUser(params: ListForUserParams = {}): Promise<Page<Bet>> {
    const addr = params.userAddress ?? this.deps.getUserAddress();
    if (!addr) throw userAddressRequired("listForUser");
    return this.deps.http.request({
      path: Endpoints.bets.forUser(addr),
      query: {
        pageSize: params.pageSize,
        cursor: params.cursor ?? undefined,
      },
      schema: BetsPageSchema,
      signal: params.signal,
    });
  }

  /** Lazy iterator over every page of `listForUser`. Stops when `signal` aborts. */
  iterateForUser(params: Omit<ListForUserParams, "cursor"> = {}): AsyncGenerator<Bet> {
    return iteratePages((cursor) => this.listForUser({ ...params, cursor }), params.signal);
  }
}

function userAddressRequired(method: string): ToncastError {
  return new ToncastError(
    `${method} requires userAddress — pass it in options, set in ToncastClient constructor, or use client.setUserAddress(addr).`,
    "USER_ADDRESS_REQUIRED",
  );
}
