import { z } from "zod";

export const CoefficientHistoryPointSchema = z.object({
  timestamp: z.number().int(),
  /** YES coefficient (yesOdds), 2..98. */
  coefficient: z.number().int(),
});

export type CoefficientHistoryPoint = z.infer<typeof CoefficientHistoryPointSchema>;

export const CoefficientHistorySchema = z.object({
  pariAddress: z.string(),
  history: z.array(CoefficientHistoryPointSchema),
});

export type CoefficientHistory = z.infer<typeof CoefficientHistorySchema>;

export type CoefficientHistoryTimeframe = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
