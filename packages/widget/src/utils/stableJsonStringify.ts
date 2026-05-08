/**
 * JSON.stringify with sorted object keys and BigInt → string, for stable useMemo deps.
 * Avoids redundant recomputes when key order differs; prevents throw if BigInt appears in config.
 */
export function stableJsonStringify(value: unknown): string {
  const normalize = (val: unknown): unknown => {
    if (typeof val === "bigint") return val.toString();
    if (val === null || typeof val !== "object") return val;
    if (Array.isArray(val)) return val.map(normalize);
    const obj = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = normalize(obj[key]);
    }
    return sorted;
  };
  return JSON.stringify(normalize(value));
}
