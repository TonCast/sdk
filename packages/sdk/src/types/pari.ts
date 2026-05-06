import { z } from "zod";

/**
 * `availableBets` arrives as a JSON-encoded string `{ "<yesOdds>": "<address>", ... }`.
 * We parse it eagerly into a `Record<number, string>` so consumers don't have to.
 *
 * Lenient: legacy v1 paris (and some inactive ones) ship malformed or non-object
 * payloads — treat anything that doesn't look like a {odds: address} map as `null`
 * instead of failing the whole response.
 */
const AvailableBetsSchema = z.string().transform((str): Record<number, string> | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(str);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const result: Record<number, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const n = Number(k);
    if (!Number.isInteger(n) || n < 0 || typeof v !== "string") return null;
    result[n] = v;
  }
  return result;
});

// `status`, `result`, `version` are intentionally typed as `z.string()`, not enums.
// In production we accept ANY value the backend ships so a new value (e.g. a new
// pari status added without an SDK release) doesn't crash existing integrations.
// Known values for reference:
//   status:  "active" | "inactive" | "paused"
//   result:  "pending" | "yes" | "no" | "draw"
//   version: "v1" | "v2" | "v3" (and `null` for legacy paris with no version field)
export const PariSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  endTime: z.number().int(),
  image: z.string(),
  yesVolume: z.number(),
  noVolume: z.number(),
  status: z.string(),
  result: z.string(),
  createdAt: z.number().int(),
  // Backend returns boolean from /v1/paris and a `0|1` number from /v1/paris/:id.
  isVisible: z.union([z.boolean(), z.number()]).transform((v) => Boolean(v)),
  bestYesOdds: z.number().int().nullable(),
  bestNoOdds: z.number().int().nullable(),
  version: z.string().nullable(),
  availableBets: AvailableBetsSchema.nullable(),
});

export type Pari = z.infer<typeof PariSchema>;
