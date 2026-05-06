// Wire types for `wss://toncast.me/ws/<pariAddress>`.
//
// Per-pari Cloudflare Durable Object. Identical ping/pong + checkSync flow as
// pari-list, BUT: messages do NOT have a top-level envelope merge — instead
// every payload is shaped `{ type, pariAddress, data, timestamp, sequenceId? }`
// (see frontend's `WSMessage<T>` type).
//
// Comment events (`comment_added`) are silently ignored: no Comment type / no
// comments resource in this SDK. Will be added in a later iteration.

import { z } from "zod";

const Base = z.object({
  pariAddress: z.string(),
  timestamp: z.number().int(),
  sequenceId: z.number().int().optional(),
});

const BetPlacedWithOddsData = z.object({
  newBets: z.array(
    z.object({
      id: z.number().int(),
      userAddress: z.string(),
      userName: z.string().nullable().optional(),
      userImage: z.string().nullable().optional(),
      yesOdds: z.number().int(),
      ticketsCount: z.number().int(),
      remainingTickets: z.number().int(),
      isYes: z.boolean(),
      amount: z.number(),
      createdAt: z.number().int(),
    }),
  ),
  matchedPairs: z
    .array(
      z.object({
        userYes: z.string(),
        userNo: z.string(),
        yesOdds: z.number().int(),
        matchedTickets: z.number().int(),
        totalAmount: z.number(),
      }),
    )
    .optional(),
  oddsState: z.object({ Yes: z.array(z.number()), No: z.array(z.number()) }),
});

const PariUpdatedData = z.object({
  /** Volume delta in nanotons. SDK converts to TON-units before exposing. */
  deltaYesVolume: z.number(),
  deltaNoVolume: z.number(),
});

const PariResultSetData = z.object({
  result: z.string(),
  status: z.literal("inactive"),
});

const PariPausedData = z.object({
  status: z.literal("paused"),
});

const CoefficientChangedData = z.object({
  yesCoefficient: z.number().int(),
  txHash: z.string().optional(),
});

const BetPlacedWithOddsMsg = Base.extend({
  type: z.literal("bet_placed_with_odds"),
  data: BetPlacedWithOddsData,
});

const PariUpdatedMsg = Base.extend({
  type: z.literal("pari_updated"),
  data: PariUpdatedData,
});

const PariResultSetMsg = Base.extend({
  type: z.literal("pari_result_set"),
  data: PariResultSetData,
});

const PariPausedMsg = Base.extend({
  type: z.literal("pari_paused"),
  data: PariPausedData,
});

const CoefficientChangedMsg = Base.extend({
  type: z.literal("coefficient_changed"),
  data: CoefficientChangedData,
});

const PongMsg = z.object({ type: z.literal("pong") });

const SyncStatusMsg = z.object({
  type: z.literal("syncStatus"),
  isLatest: z.boolean(),
  currentSequence: z.number().int().optional(),
});

// `comment_added` is recognised but ignored (no Comment type yet).
const CommentAddedMsg = Base.extend({
  type: z.literal("comment_added"),
  data: z.object({}).passthrough(),
});

export const PariIncomingSchema = z.discriminatedUnion("type", [
  BetPlacedWithOddsMsg,
  PariUpdatedMsg,
  PariResultSetMsg,
  PariPausedMsg,
  CoefficientChangedMsg,
  CommentAddedMsg,
  PongMsg,
  SyncStatusMsg,
]);

export type PariIncomingMessage = z.infer<typeof PariIncomingSchema>;
export type BetPlacedWithOddsMessage = z.infer<typeof BetPlacedWithOddsMsg>;
export type PariUpdatedMessage = z.infer<typeof PariUpdatedMsg>;
export type PariResultSetMessage = z.infer<typeof PariResultSetMsg>;
export type PariPausedMessage = z.infer<typeof PariPausedMsg>;
export type CoefficientChangedMessage = z.infer<typeof CoefficientChangedMsg>;
export type SyncStatusMessage = z.infer<typeof SyncStatusMsg>;

/** Public event for `onBetEvent` — surfaces what the broadcast carried. */
export interface BetEvent {
  newBets: BetPlacedWithOddsMessage["data"]["newBets"];
  matchedPairs: NonNullable<BetPlacedWithOddsMessage["data"]["matchedPairs"]>;
  /** Server timestamp in ms. */
  timestamp: number;
}
