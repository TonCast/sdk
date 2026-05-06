import { z } from "zod";

export const PariWinnerSchema = z.object({
  userAddress: z.string(),
  /** Total payout in nano-TON. */
  winAmount: z.number(),
  matchedTickets: z.number().int(),
  side: z.enum(["yes", "no"]),
});

export type PariWinner = z.infer<typeof PariWinnerSchema>;
