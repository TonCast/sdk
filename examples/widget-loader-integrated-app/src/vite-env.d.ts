/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override CDN URL for `ToncastWidgetLoader.load()` (e.g. Cloudflare Workers mirror). */
  readonly VITE_WIDGET_CDN_URL?: string;
  /** Full URL to TonConnect manifest JSON (optional; default is an in-memory blob with matching `url`). */
  readonly VITE_TONCONNECT_MANIFEST_URL?: string;
  /** Default widget UI language (`widget.language`), e.g. `ru`. Must be a supported code. */
  readonly VITE_WIDGET_LANGUAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
