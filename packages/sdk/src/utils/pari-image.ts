/**
 * Cover-art URL helper for `Pari.image`.
 *
 * The `image` field on a pari is one of:
 *  - a Cloudflare Images UUID (the typical case — pari covers uploaded
 *    through the Toncast admin)
 *  - a **numeric** Cloudflare Images id (older / migrated paris — same
 *    `cdn-cgi/imagedelivery/.../{id}/...` path as UUIDs)
 *  - an absolute `http(s)://` URL (legacy / external assets)
 *  - empty / null (no cover, returns `null`)
 *  - anything else that isn't URL / UUID / numeric id (returns `null`)
 *
 * For Cloudflare-hosted assets the SDK builds a URL against Toncast's
 * Cloudflare account so callers don't have to bake account ids / CDN
 * paths into their app. The `variant` controls the resize / encoding
 * pipeline run by Cloudflare's `cdn-cgi` worker — pass any combination
 * Cloudflare Images supports (e.g. `"w=400,h=400,fit=contain,format=webp,quality=85"`).
 */
const TONCAST_CF_ACCOUNT = "OQe1vxXdz8f9uuGC1-2leA";
const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
/** Cloudflare custom image ids for legacy paris are plain decimal strings (see API fixtures). */
const CF_NUMERIC_IMAGE_RE = /^\d{8,24}$/;

export const DEFAULT_PARI_COVER_VARIANT =
  "w=400,h=400,fit=contain,format=webp,quality=85";

export function pariCoverUrl(
  image: string | null | undefined,
  variant: string = DEFAULT_PARI_COVER_VARIANT,
): string | null {
  if (!image) return null;
  const trimmed = image.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (UUID_RE.test(trimmed) || CF_NUMERIC_IMAGE_RE.test(trimmed)) {
    return `https://toncast.me/cdn-cgi/imagedelivery/${TONCAST_CF_ACCOUNT}/${trimmed}/${variant}`;
  }
  return null;
}
