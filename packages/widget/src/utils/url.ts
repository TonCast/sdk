/**
 * Parses `raw` as an absolute http(s) URL. Returns the parsed URL or `null`
 * if `raw` is empty, malformed, or uses a non-http(s) scheme.
 *
 * Accepts whitespace-padded input. Does NOT mutate the URL (no normalization,
 * no trailing-slash trimming) — callers do that explicitly when needed.
 */
export function parseHttpUrl(raw: unknown): URL | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url;
}

/** Removes one or more trailing `/` characters (empty string stays empty). */
export function stripTrailingSlashes(input: string): string {
  return input.replace(/\/+$/, "");
}
