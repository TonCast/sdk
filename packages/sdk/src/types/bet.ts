import { z } from "zod";

export const BetStatusSchema = z.enum([
  "placed",
  "matched",
  "cancelled",
  "won",
  "lost",
  "refunded",
  "won_yes",
  "won_no",
]);

export type BetStatus = z.infer<typeof BetStatusSchema>;

/**
 * Single bet record. Shape varies slightly between endpoints — fields beyond the
 * `required` ones in OpenAPI are marked optional so a single type can describe
 * `/bets/{pariAddress}/user/{userAddress}` and (future) community feeds.
 */
export const BetSchema = z.object({
  id: z.number().int(),
  pariAddress: z.string(),
  yesOdds: z.number().int(),
  ticketsCount: z.number().int(),
  isYes: z.boolean(),
  /** Bet amount in nano-TON. */
  amount: z.number(),
  status: BetStatusSchema,
  createdAt: z.number().int(),

  // Joined-in pari info (present on user-bet endpoints).
  pariName: z.string().optional(),
  pariImage: z.string().optional(),

  // Present on community feeds — nullable on backend.
  userAddress: z.string().optional(),
  userName: z.string().nullable().optional(),
  userImage: z.string().nullable().optional(),

  // Lifecycle accounting.
  remainingTickets: z.number().int().optional(),
  totalWinAmount: z.number().nullable().optional(),
  matchedTickets: z.number().int().optional(),
  wonTickets: z.number().int().optional(),
  lostTickets: z.number().int().optional(),
  refundedTickets: z.number().int().optional(),
  cancelledTickets: z.number().int().optional(),
  isCancellable: z.boolean().optional(),
  queueIndex: z.number().nullable().optional(),
});

export type Bet = z.infer<typeof BetSchema>;
