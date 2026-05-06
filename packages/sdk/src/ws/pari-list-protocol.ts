// Wire types for `wss://toncast.me/ws/pari-list`.
//
// Backend reference (verified against frontend repo + smoke):
//   - One global Cloudflare Durable Object room broadcasts to every client.
//   - Ping/pong handled by CF runtime via `setWebSocketAutoResponse` —
//     the JS handler never sees the ping. Client sends `{type:"ping"}`,
//     CF auto-replies `{type:"pong"}`.
//   - Only inbound message: `{type:"checkSync", lastSeen: <number>}`.
//   - Server reply: `{type:"syncStatus", isLatest: boolean, currentSequence?: number}`
//     (NOT wrapped in envelope — no sequenceId/timestamp on syncStatus).
//   - Broadcast messages carry envelope: `sequenceId: number, timestamp: number`.

import { z } from "zod";

import type { SupportedLanguage } from "../i18n/languages";
import type { Pari } from "../types/pari";

/** Wire-level enum, kept as string literals to mirror the protocol exactly. */
export const PariListMsgType = {
  COEFFICIENT_UPDATE: "coefficient_update",
  VOLUME_UPDATE: "volume_update",
  PARI_CREATED: "pari_created",
  PARI_RESULT_SET: "pari_result_set",
  PARI_PAUSED: "pari_paused",
  PING: "ping",
  PONG: "pong",
  CHECK_SYNC: "checkSync",
  SYNC_STATUS: "syncStatus",
} as const;

// ─── Broadcast payloads ───────────────────────────────────────────────────────

const CoefficientUpdateData = z.object({
  pariAddress: z.string(),
  bestYesOdds: z.number().int().nullable(),
  timestamp: z.number().int(),
  txHash: z.string().optional(),
});

const VolumeUpdateData = z.object({
  pariAddress: z.string(),
  /** Volume deltas in TON (added to current values on the client). */
  deltaYesVolume: z.number(),
  deltaNoVolume: z.number(),
  timestamp: z.number().int(),
});

// `pari_created` carries every supported language inline. `name_en` / `description_en`
// are guaranteed; the rest are optional and may be `null`. Extra keys (e.g. a new
// language not in our enum yet) are passed through unchanged.
const PariCreatedData = z.object({
  id: z.string(),
  endTime: z.number().int(),
  image: z.string(),
  yesVolume: z.number(),
  noVolume: z.number(),
  status: z.string(),
  result: z.string(),
  createdAt: z.number().int(),
  isVisible: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
  availableBets: z.string().nullable(),
  /** Backend uses this to route the new pari to the right per-category list. */
  categoryId: z.number().int().nullable().optional(),

  // Localized fields — see SUPPORTED_LANGUAGES in src/i18n/languages.ts
  name_en: z.string(),
  name_ru: z.string().nullable().optional(),
  name_hi: z.string().nullable().optional(),
  name_es: z.string().nullable().optional(),
  name_zh: z.string().nullable().optional(),
  name_fr: z.string().nullable().optional(),
  name_de: z.string().nullable().optional(),
  name_pt: z.string().nullable().optional(),
  name_fa: z.string().nullable().optional(),
  name_ar: z.string().nullable().optional(),
  description_en: z.string(),
  description_ru: z.string().nullable().optional(),
  description_hi: z.string().nullable().optional(),
  description_es: z.string().nullable().optional(),
  description_zh: z.string().nullable().optional(),
  description_fr: z.string().nullable().optional(),
  description_de: z.string().nullable().optional(),
  description_pt: z.string().nullable().optional(),
  description_fa: z.string().nullable().optional(),
  description_ar: z.string().nullable().optional(),
});

const PariResultSetData = z.object({
  pariAddress: z.string(),
  result: z.string(),
  status: z.string(),
});

const PariPausedData = z.object({
  pariAddress: z.string(),
  status: z.string(),
});

// ─── Envelope (every broadcast carries it; syncStatus does NOT) ───────────────

const Envelope = z.object({
  sequenceId: z.number().int(),
  timestamp: z.number().int(),
});

const CoefficientUpdateMsg = z
  .object({
    type: z.literal(PariListMsgType.COEFFICIENT_UPDATE),
    data: CoefficientUpdateData,
  })
  .merge(Envelope);

const VolumeUpdateMsg = z
  .object({
    type: z.literal(PariListMsgType.VOLUME_UPDATE),
    data: VolumeUpdateData,
  })
  .merge(Envelope);

const PariCreatedMsg = z
  .object({
    type: z.literal(PariListMsgType.PARI_CREATED),
    data: PariCreatedData,
  })
  .merge(Envelope);

const PariResultSetMsg = z
  .object({
    type: z.literal(PariListMsgType.PARI_RESULT_SET),
    data: PariResultSetData,
  })
  .merge(Envelope);

const PariPausedMsg = z
  .object({
    type: z.literal(PariListMsgType.PARI_PAUSED),
    data: PariPausedData,
  })
  .merge(Envelope);

const PongMsg = z.object({ type: z.literal(PariListMsgType.PONG) });

const SyncStatusMsg = z.object({
  type: z.literal(PariListMsgType.SYNC_STATUS),
  isLatest: z.boolean(),
  currentSequence: z.number().int().optional(),
});

export const PariListIncomingSchema = z.discriminatedUnion("type", [
  CoefficientUpdateMsg,
  VolumeUpdateMsg,
  PariCreatedMsg,
  PariResultSetMsg,
  PariPausedMsg,
  PongMsg,
  SyncStatusMsg,
]);

export type PariListIncomingMessage = z.infer<typeof PariListIncomingSchema>;
export type CoefficientUpdateMessage = z.infer<typeof CoefficientUpdateMsg>;
export type VolumeUpdateMessage = z.infer<typeof VolumeUpdateMsg>;
export type PariCreatedMessage = z.infer<typeof PariCreatedMsg>;
export type PariCreatedPayload = z.infer<typeof PariCreatedData>;
export type PariResultSetMessage = z.infer<typeof PariResultSetMsg>;
export type PariPausedMessage = z.infer<typeof PariPausedMsg>;
export type SyncStatusMessage = z.infer<typeof SyncStatusMsg>;

/**
 * Convert a `pari_created` broadcast (which carries every supported language
 * in one payload) into a localized `Pari` matching the shape returned by
 * `paris.list`. `bestYesOdds`/`bestNoOdds`/`version` are nullable on creation.
 */
export function localisePariCreated(
  payload: PariCreatedPayload,
  language: SupportedLanguage,
): Pari {
  const nameKey = `name_${language}` as keyof PariCreatedPayload;
  const descKey = `description_${language}` as keyof PariCreatedPayload;
  const name = ((payload[nameKey] as string | null | undefined) ?? payload.name_en) as string;
  const description = ((payload[descKey] as string | null | undefined) ??
    payload.description_en) as string;

  let availableBets: Record<number, string> | null = null;
  if (payload.availableBets) {
    try {
      const obj = JSON.parse(payload.availableBets) as Record<string, unknown>;
      const out: Record<number, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        const n = Number(k);
        if (Number.isInteger(n) && n >= 0 && typeof v === "string") out[n] = v;
      }
      availableBets = out;
    } catch {
      availableBets = null;
    }
  }

  return {
    id: payload.id,
    name,
    description,
    endTime: payload.endTime,
    image: payload.image,
    yesVolume: payload.yesVolume,
    noVolume: payload.noVolume,
    status: payload.status,
    result: payload.result,
    createdAt: payload.createdAt,
    // Coerce defensively in case caller passes a raw payload that hasn't gone through the schema.
    isVisible: Boolean(payload.isVisible),
    bestYesOdds: null,
    bestNoOdds: null,
    version: null,
    availableBets,
  };
}
