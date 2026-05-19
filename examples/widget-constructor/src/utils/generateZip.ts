import type { ConstructorConfig } from "../types";
import { buildManifestJson } from "./manifest";
import { buildIndexHtml, resolveHostBackdropColors } from "./snippets";

/** Delay before revoking blob URLs so slow browsers can finish the download handshake. */
const OBJECT_URL_REVOKE_DELAY_MS = 5000;

/**
 * Page mat behind the widget in Live Preview / export: uses optional shell bg
 * when set, otherwise the same defaults as the widget (`--tc-bg` light/dark).
 */
export function previewBackdropFromConfig(config: ConstructorConfig, prefersDark: boolean): string {
  const { light: lightBody, dark: darkBody } = resolveHostBackdropColors(config);
  if (config.theme.colorScheme === "dark") return darkBody;
  if (config.theme.colorScheme === "light") return lightBody;
  return prefersDark ? darkBody : lightBody;
}

export async function downloadZip(config: ConstructorConfig): Promise<void> {
  const [{ default: JSZip }, { default: widgetIifeCss }] = await Promise.all([
    import("jszip"),
    /** Minified at bundle time via `minifyWidgetCssRawPlugin` — stays out of the main chunk. */
    import("@toncast/widget/styles/widget.css?raw"),
  ]);
  const zip = new JSZip();
  const folder = zip.folder("toncast-widget");
  if (!folder) throw new Error("Failed to create zip folder");

  folder.file("index.html", buildIndexHtml(config));
  folder.file("index.iife.css", widgetIifeCss);
  folder.file("tonconnect-manifest.json", buildManifestJson(config));

  const blob = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "toncast-widget.zip";
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
  }
}
