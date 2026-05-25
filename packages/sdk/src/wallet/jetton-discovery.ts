import { z } from "zod";
import type { Logger, TonClient } from "../client/config";
import { ToncastApiError, ToncastValidationError } from "../errors";
import { withRetry } from "../utils/retry";

/**
 * One jetton position discovered for a wallet. Decimals/symbol come from the
 * toncenter v3 metadata index. `decimals` defaults to **9** when the master
 * doesn't publish the field — that's the TEP-74 spec, not a guess.
 */
export interface DiscoveredJetton {
  /** Jetton master address. */
  address: string;
  /** Raw amount in the jetton's smallest units. */
  amount: bigint;
  symbol?: string;
  decimals?: number;
}

/**
 * Per TEP-74 (https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md),
 * `decimals` defaults to 9 when a jetton master omits it from on-chain metadata.
 * Toncenter v3 reports `undefined` in that case (it's a literal indexer);
 * we apply the spec default so consumers get a consistent value.
 */
const TEP74_DEFAULT_DECIMALS = 9;

/**
 * Advanced override for jetton discovery. **Optional.** Default behaviour
 * (`undefined`) auto-derives the toncenter v3 endpoint from `tonClient` —
 * works for 99% of integrations without configuration.
 *
 * Use this only if you need a private toncenter gateway, a paid plan with
 * a different URL, or your `tonClient` is pointed at a non-toncenter RPC.
 */
export interface JettonDiscoveryOptions {
  /**
   * Override the toncenter v3 endpoint (and optionally its API key).
   * If set, takes precedence over the auto-derived value from `tonClient`.
   */
  toncenter?: { endpoint: string; apiKey?: string | undefined } | undefined;
}

/**
 * Discovers all jetton balances for `ownerAddress` via toncenter v3
 * (`…/api/v3/jetton/wallets`). Source resolution:
 *
 *  1. `opts.toncenter` if provided
 *  2. else derived from `tonClient.parameters.endpoint` (when it matches
 *     `…/api/v2/jsonRPC` — same API key reused)
 *
 * Failures degrade gracefully: returns `[]` and logs a warning. The caller
 * still gets the user's TON balance (`coins.list()` always reports it).
 *
 * No tonapi.io fallback — toncenter is the single source of truth, and we
 * apply the TEP-74 spec for any missing `decimals` so output is consistent.
 */
export async function discoverJettons(
  ownerAddress: string,
  tonClient: TonClient | undefined,
  logger: Logger,
  signal?: AbortSignal | undefined,
  opts: JettonDiscoveryOptions = {},
): Promise<DiscoveredJetton[]> {
  const toncenter = opts.toncenter ?? deriveToncenterV3(tonClient);
  if (!toncenter) {
    logger.warn(
      "coins.list: no toncenter v3 endpoint available (tonClient is not pointed at /api/v2/jsonRPC and no opts.toncenter override) — returning TON only",
    );
    return [];
  }
  try {
    return await discoverViaToncenterV3(ownerAddress, toncenter, signal);
  } catch (err) {
    logger.warn("coins.list: toncenter v3 jetton discovery failed — returning TON only", err);
    return [];
  }
}

/**
 * Derives a toncenter v3 endpoint + api key from the user's `TonClient`, when
 * the latter is pointed at the canonical `/api/v2/jsonRPC` URL.
 *
 * `apiKey` lives on `tonClient.api.parameters.apiKey` — not a documented
 * public field of `@ton/ton`, but stable across versions. Reading it is a
 * convenience so the integrator doesn't have to pass the same key twice.
 */
function deriveToncenterV3(
  tonClient: TonClient | undefined,
): { endpoint: string; apiKey?: string | undefined } | null {
  if (!tonClient) return null;
  const endpoint = tonClient.parameters.endpoint;
  const v2Match = /\/api\/v2\/jsonRPC\/?$/i;
  if (!v2Match.test(endpoint)) return null;
  const v3 = endpoint.replace(v2Match, "/api/v3");
  const apiKey = (tonClient as unknown as { api?: { parameters?: { apiKey?: string } } }).api
    ?.parameters?.apiKey;
  return apiKey === undefined ? { endpoint: v3 } : { endpoint: v3, apiKey };
}

const ToncenterV3JettonWallet = z
  .object({
    balance: z.string(),
    jetton: z.string(),
    owner: z.string().optional(),
    address: z.string().optional(),
  })
  .passthrough();

const ToncenterV3JettonsResponse = z
  .object({
    jetton_wallets: z.array(ToncenterV3JettonWallet),
    metadata: z
      .record(
        z.string(),
        z
          .object({
            token_info: z
              .array(
                z
                  .object({
                    symbol: z.string().optional(),
                    name: z.string().optional(),
                    extra: z.record(z.string(), z.unknown()).optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const JETTON_WALLETS_PAGE_SIZE = 256;

async function discoverViaToncenterV3(
  ownerAddress: string,
  opts: { endpoint: string; apiKey?: string | undefined },
  signal?: AbortSignal | undefined,
): Promise<DiscoveredJetton[]> {
  const base = `${opts.endpoint.replace(/\/+$/, "")}/jetton/wallets`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.apiKey) headers["X-Api-Key"] = opts.apiKey;

  const out: DiscoveredJetton[] = [];
  const mergedMeta: NonNullable<z.infer<typeof ToncenterV3JettonsResponse>["metadata"]> = {};

  for (let offset = 0; ; offset += JETTON_WALLETS_PAGE_SIZE) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const url = new URL(base);
    url.searchParams.set("owner_address", ownerAddress);
    url.searchParams.set("exclude_zero_balance", "true");
    url.searchParams.set("limit", String(JETTON_WALLETS_PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const json = await withRetry(
      async () => {
        const init: RequestInit = { headers };
        if (signal) init.signal = signal;
        const res = await fetch(url, init);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new ToncastApiError(
            `Toncenter v3 ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
            res.status,
            "/jetton/wallets",
          );
        }
        return (await res.json()) as unknown;
      },
      { maxAttempts: 3, delayMs: 1000, rateLimitBackoffMultiplier: 3, signal },
    );
    const parsed = ToncenterV3JettonsResponse.safeParse(json);
    if (!parsed.success) {
      throw new ToncastValidationError(
        "Toncenter v3 /jetton/wallets response shape unexpected",
        parsed.error,
      );
    }

    if (parsed.data.metadata) {
      Object.assign(mergedMeta, parsed.data.metadata);
    }

    const page = parsed.data.jetton_wallets;
    for (const w of page) {
      let amount: bigint;
      try {
        amount = BigInt(w.balance);
      } catch {
        continue;
      }
      if (amount <= 0n) continue;
      const tokenInfo = mergedMeta[w.jetton]?.token_info?.[0];
      const jetton: DiscoveredJetton = {
        address: w.jetton,
        amount,
        decimals: extractDecimals(tokenInfo?.extra) ?? TEP74_DEFAULT_DECIMALS,
      };
      if (tokenInfo?.symbol !== undefined) jetton.symbol = tokenInfo.symbol;
      out.push(jetton);
    }

    if (page.length < JETTON_WALLETS_PAGE_SIZE) break;
  }

  return out;
}

function extractDecimals(extra: Record<string, unknown> | undefined): number | undefined {
  if (!extra) return undefined;
  const d = extra.decimals;
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const n = Number(d);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
