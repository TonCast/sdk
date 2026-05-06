/**
 * Replace any `BigInt` in a value with its decimal string. Used to build
 * `queryKey` entries for hooks whose params include `BigInt` (e.g.
 * `useBetQuote`'s `maxBudgetTon`, `useBetSummary`'s nothing-yet-but-future-
 * proof). TanStack's default `hashKey` runs `JSON.stringify`, which throws on
 * `BigInt` — so we sanitise once at the call site.
 *
 * Object identity is NOT preserved (returns a fresh, plain JSON-friendly
 * structure), but TanStack only ever calls `hashKey` on this value, so it's
 * never observed by user code.
 */
export function serializeKey<T>(value: T): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(serializeKey);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = serializeKey(v);
  }
  return out;
}
