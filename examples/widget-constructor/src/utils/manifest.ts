import { parseHttpUrl, stripTrailingSlashes } from "@toncast/widget/url";
import type { ConstructorConfig } from "../types";
import { PLACEHOLDER_DOMAIN } from "./buildWidgetConfig";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the trimmed value when it parses as an absolute http(s) URL, otherwise `null`. */
export function safeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed && parseHttpUrl(trimmed) ? stripTrailingSlashes(trimmed) : null;
}

/**
 * Builds tonconnect-manifest.json content.
 *
 * `url` and `iconUrl` are validated as absolute http(s) URLs — invalid input
 * falls back to `PLACEHOLDER_DOMAIN` and `${url}/icon-192.png` so the exported
 * manifest stays well-formed (TonConnect rejects relative or non-http URLs).
 * Each invalid field logs a `console.warn` so silent fallbacks are visible in devtools.
 */
export function buildManifestJson(config: ConstructorConfig): string {
  const resolvedUrl = safeHttpUrl(config.domain);
  const resolvedIcon = safeHttpUrl(config.iconUrl);
  const url = resolvedUrl ?? PLACEHOLDER_DOMAIN;
  const iconUrl = resolvedIcon ?? `${url}/icon-192.png`;
  if (!resolvedUrl) {
    console.warn(
      "[widget-constructor] tonconnect-manifest: invalid `domain`; using placeholder URL.",
    );
  }
  if (!resolvedIcon) {
    console.warn(
      "[widget-constructor] tonconnect-manifest: invalid `iconUrl`; using default icon path.",
    );
  }
  return JSON.stringify(
    {
      url,
      name: config.appName.trim() || "My App",
      iconUrl,
    },
    null,
    2,
  );
}
