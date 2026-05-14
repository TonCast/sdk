type ViteOptionalStringKey =
  | "VITE_WIDGET_CDN_URL"
  | "VITE_TONCONNECT_MANIFEST_URL"
  | "VITE_WIDGET_LANGUAGE";

/** Trimmed non-empty string, or undefined (shared by CDN, manifest, and widget locale). */
export function nonEmptyTrim(s: string | undefined): string | undefined {
  return typeof s === "string" && s.trim() !== "" ? s.trim() : undefined;
}

/** Optional Vite env string, trimmed (same pattern for host-tunable URLs and strings). */
export function viteEnvTrimmed(key: ViteOptionalStringKey): string | undefined {
  return nonEmptyTrim(import.meta.env[key] as string | undefined);
}

/**
 * TonConnect `manifestUrl`: optional prop/env, else JSON blob with `url` = current origin
 * (avoids a static manifest whose `url` mismatches localhost vs deploy).
 */
export function resolveTonconnectManifestUrl(manifestUrlProp?: string): string {
  const explicit = nonEmptyTrim(manifestUrlProp) ?? viteEnvTrimmed("VITE_TONCONNECT_MANIFEST_URL");
  if (explicit) return explicit;
  const json = JSON.stringify({
    url: window.location.origin,
    name: "Toncast widget-loader example",
    iconUrl: "https://toncast.me/logo.png",
  });
  return URL.createObjectURL(new Blob([json], { type: "application/json" }));
}
