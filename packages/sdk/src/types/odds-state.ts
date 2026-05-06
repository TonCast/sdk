import type { OddsState } from "@toncast/tx-sdk";
import { z } from "zod";

// Re-export so consumers can import `OddsState` from "@toncast/sdk/types"
// (or wherever) without reaching into tx-sdk. Single source of truth — same
// declaration as tx-sdk's, no aliasing, no structural duplicate in .d.ts.
export type { OddsState };

/**
 * Runtime schema for the order book snapshot. Typed against `@toncast/tx-sdk`'s
 * `OddsState` so the parsed value plugs straight into `quoteLimitBet` /
 * `quoteMarketBet` without any cast.
 *
 * Indexing convention (each array is 49 entries, odds 2..98 step 2):
 * - `Yes[i]` — YES tickets at yesOdds = `2 * (i + 1)`.
 * - `No[i]`  — NO tickets at NO-probability `2 * (i + 1)`, i.e. yesOdds = `100 - 2 * (i + 1)`.
 *
 * Use `availableTickets(state, isYes, yesOdds)` from tx-sdk to read by yesOdds
 * without hand-indexing the asymmetric NO side.
 */
/**
 * Each side has exactly 49 buckets (odds 2..98 step 2). Enforced at parse time —
 * a shorter array would let `availableTickets(state, isYes, yesOdds)` index into
 * `undefined` and silently return NaN through the rest of the betting math.
 */
export const ODDS_BUCKET_COUNT = 49;

export const OddsStateSchema: z.ZodType<OddsState> = z.object({
  Yes: z.array(z.number()).length(ODDS_BUCKET_COUNT),
  No: z.array(z.number()).length(ODDS_BUCKET_COUNT),
});

/** Backend wraps the snapshot in `{ oddsState: ... }` — we unwrap eagerly. */
export const OddsStateResponseSchema = z
  .object({ oddsState: OddsStateSchema })
  .transform((r) => r.oddsState);
