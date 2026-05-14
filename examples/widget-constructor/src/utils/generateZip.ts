import type {
  ToncastWidgetCssVars,
  ToncastWidgetCssVarsBase,
} from "@toncast/widget";
import { safeHexColor } from "@toncast/widget/color-math";
import { RADIUS_DEFAULT } from "@toncast/widget/constants";
import { deriveCssVars } from "@toncast/widget/css-vars-builder";
import {
  densityPresetToCssCustomProperties,
  WIDGET_DENSITY_PRESETS,
} from "@toncast/widget/density-presets";
import { parseHttpUrl, stripTrailingSlashes } from "@toncast/widget/url";
import { WIDGET_CDN_JS_URL } from "@toncast/widget-loader";
import widgetIifeCss from "../../../../packages/widget/src/styles/widget.css?raw";
import {
  type ConstructorConfig,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  type ThemeColorSet,
} from "../types";
import { buildWidgetConfig } from "./buildWidgetConfig";
import { clampRadius } from "./normalizeConfig";

/** Shown in export UI when no app domain is set; used in generated HTML/JS placeholders. */
export const PLACEHOLDER_DOMAIN = "https://your-domain.com";

/** Delay before revoking blob URLs so slow browsers can finish the download handshake. */
const OBJECT_URL_REVOKE_DELAY_MS = 5000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Serializes a value for embedding as JS inside HTML `<script>` (HTML/script breakout-safe). */
export function stringifyForScript(value: unknown, space: number): string {
  let json: string;
  try {
    json = JSON.stringify(value, null, space);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to serialize widget config for embedding: ${msg}`);
  }
  return json
    .replace(/<\/script/gi, "\\u003C/script")
    .replace(/-->/g, "\\u002D\\u002D\\u003E")
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Builds a "delta palette" containing only colors that differ from defaults.
 * The widget's runtime defaults already cover unchanged values, so we emit
 * overrides only for what the user actually changed (smaller style.css).
 */
function buildDeltaPalette(
  colors: ThemeColorSet,
  defaults: ThemeColorSet,
): ToncastWidgetCssVarsBase {
  const palette: ToncastWidgetCssVarsBase = {};
  const accent = safeHexColor(colors.accent);
  const bg = colors.bg ? safeHexColor(colors.bg) : null;
  const success = safeHexColor(colors.success);
  const danger = safeHexColor(colors.danger);
  const warn = safeHexColor(colors.warn);
  if (accent !== null && accent !== defaults.accent) palette.accent = accent;
  if (bg !== null) palette.bg = bg;
  if (success !== null && success !== defaults.success)
    palette.success = success;
  if (danger !== null && danger !== defaults.danger) palette.danger = danger;
  if (warn !== null && warn !== defaults.warn) palette.warn = warn;
  return palette;
}

function appendPaletteCssVars(
  lines: string[],
  colors: ThemeColorSet,
  defaults: ThemeColorSet,
  theme: "light" | "dark",
): void {
  const palette = buildDeltaPalette(colors, defaults);
  if (Object.keys(palette).length === 0) return;
  const vars = deriveCssVars(palette, theme);
  for (const [name, value] of Object.entries(vars)) {
    lines.push(`  ${name}: ${value};`);
  }
}

/** Returns the trimmed value when it parses as an absolute http(s) URL, otherwise `null`. */
function safeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed && parseHttpUrl(trimmed)
    ? stripTrailingSlashes(trimmed)
    : null;
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

const HOST_BACKDROP_LIGHT = "#f8fafc";
const HOST_BACKDROP_DARK = "#0f172a";

/** Resolves host page backdrop colors from optional theme shell `bg` values. */
export function resolveHostBackdropColors(config: ConstructorConfig): {
  light: string;
  dark: string;
} {
  const lightRaw = config.theme.light.bg?.trim();
  const darkRaw = config.theme.dark.bg?.trim();
  return {
    light: (lightRaw && safeHexColor(lightRaw)) || HOST_BACKDROP_LIGHT,
    dark: (darkRaw && safeHexColor(darkRaw)) || HOST_BACKDROP_DARK,
  };
}

/**
 * Page mat behind the widget in Live Preview / export: uses optional shell bg
 * when set, otherwise the same defaults as the widget (`--tc-bg` light/dark).
 */
export function previewBackdropFromConfig(
  config: ConstructorConfig,
  prefersDark: boolean,
): string {
  const { light: lightBody, dark: darkBody } =
    resolveHostBackdropColors(config);
  if (config.theme.colorScheme === "dark") return darkBody;
  if (config.theme.colorScheme === "light") return lightBody;
  return prefersDark ? darkBody : lightBody;
}

function paletteOrNull(
  colors: ThemeColorSet,
  defaults: ThemeColorSet,
): ToncastWidgetCssVarsBase | null {
  const palette = buildDeltaPalette(colors, defaults);
  return Object.keys(palette).length > 0 ? palette : null;
}

/**
 * Builds the `widget.cssVars` object for JS/React configs (semantic colors, radius, density).
 *
 * Return shape depends on `theme.colorScheme`:
 * - `"light"` / `"dark"`: a **flat** object — only the active palette keys are merged at the top
 *   level (e.g. `{ accent: "#...", bg: "#..." }`).
 * - `"system"`: when both palettes need overrides, returns **`light` and `dark` sub-objects**
 *   so runtime can pick by OS preference (`{ light: { ... }, dark: { ... } }`).
 *
 * Returns `undefined` when nothing differs from defaults (no overrides to emit).
 *
 * Exported so LivePreview and `buildWidgetConfig` share one implementation.
 */
export function buildCssVarsConfig(
  config: ConstructorConfig,
): ToncastWidgetCssVars | undefined {
  const { theme } = config;
  const radius = clampRadius(theme.radius);

  const vars: ToncastWidgetCssVars = {};

  if (radius !== RADIUS_DEFAULT) vars.radius = `${radius}px`;
  if (theme.density !== "default") vars.density = theme.density;

  const lightVars = paletteOrNull(theme.light, DEFAULT_LIGHT_COLORS);
  const darkVars = paletteOrNull(theme.dark, DEFAULT_DARK_COLORS);

  if (theme.colorScheme === "light") {
    if (lightVars) Object.assign(vars, lightVars);
  } else if (theme.colorScheme === "dark") {
    if (darkVars) Object.assign(vars, darkVars);
  } else {
    // System: emit per-theme sub-objects so each mode gets its own palette
    if (lightVars) vars.light = lightVars;
    if (darkVars) vars.dark = darkVars;
  }

  return Object.keys(vars).length > 0 ? vars : undefined;
}

/** Builds optional host CSS overrides for the widget container (for CSS snippet export). */
export function buildStyleCss(config: ConstructorConfig): string | null {
  const { theme } = config;
  const radius = clampRadius(theme.radius);

  const baseLines: string[] = [];
  if (radius !== RADIUS_DEFAULT) baseLines.push(`  --tc-radius: ${radius}px;`);
  // Emit density spacing tokens (same presets as @toncast/widget WIDGET_DENSITY_PRESETS).
  if (theme.density !== "default") {
    const preset = WIDGET_DENSITY_PRESETS[theme.density];
    const densityVars = densityPresetToCssCustomProperties(preset);
    for (const [k, v] of Object.entries(densityVars))
      baseLines.push(`  ${k}: ${v};`);
  }

  const lightLines: string[] = [];
  if (theme.colorScheme !== "dark") {
    appendPaletteCssVars(
      lightLines,
      theme.light,
      DEFAULT_LIGHT_COLORS,
      "light",
    );
  }

  const darkLines: string[] = [];
  if (theme.colorScheme !== "light") {
    appendPaletteCssVars(darkLines, theme.dark, DEFAULT_DARK_COLORS, "dark");
  }

  const hasOverrides =
    baseLines.length > 0 || lightLines.length > 0 || darkLines.length > 0;
  if (!hasOverrides) return null;

  const out: string[] = [];

  if (theme.colorScheme === "system") {
    // Light vars go in the base block; dark vars in a media query override
    const allBaseLines = [...baseLines, ...lightLines];
    if (allBaseLines.length > 0) {
      out.push("#toncast-widget {", ...allBaseLines, "}");
    }
    if (darkLines.length > 0) {
      out.push(
        "@media (prefers-color-scheme: dark) {",
        "  #toncast-widget {",
        ...darkLines.map((l) => `  ${l}`),
        "  }",
        "}",
      );
    }
  } else if (theme.colorScheme === "dark") {
    const allLines = [...baseLines, ...darkLines];
    if (allLines.length > 0) {
      out.push("#toncast-widget {", ...allLines, "}");
    }
  } else {
    const allLines = [...baseLines, ...lightLines];
    if (allLines.length > 0) {
      out.push("#toncast-widget {", ...allLines, "}");
    }
  }

  return out.length > 0 ? out.join("\n") : null;
}

/** `color-scheme` value for the exported host `<html>` shell. */
function buildRootColorScheme(config: ConstructorConfig): string {
  if (config.theme.colorScheme === "dark") return "dark";
  if (config.theme.colorScheme === "light") return "light";
  return "light dark";
}

/** CSS fragment for host `html`/`body` backdrop (matches live preview mat colors). */
function buildHostShellBackdropCss(config: ConstructorConfig): {
  rootColorScheme: string;
  bodyBackground: string;
  systemDarkCss: string;
} {
  const { light: bodyBgLight, dark: bodyBgDark } =
    resolveHostBackdropColors(config);
  const isSystem = config.theme.colorScheme === "system";
  const isDark = config.theme.colorScheme === "dark";
  const bodyBackground = isDark ? bodyBgDark : bodyBgLight;
  const systemDarkCss = isSystem
    ? `\n      @media (prefers-color-scheme: dark) {\n        html, body { background: ${bodyBgDark}; color-scheme: dark; }\n      }`
    : "";
  return {
    rootColorScheme: buildRootColorScheme(config),
    bodyBackground,
    systemDarkCss,
  };
}

export function buildIndexHtml(config: ConstructorConfig): string {
  // Empty domain would break TonConnect (invalid manifest URL).
  const domain = stripTrailingSlashes(config.domain || PLACEHOLDER_DOMAIN);
  const widgetConfig = buildWidgetConfig(config, { domain });

  const css = buildStyleCss(config);
  const { rootColorScheme, bodyBackground, systemDarkCss } =
    buildHostShellBackdropCss(config);

  const iifeCssLink =
    '\n    <link rel="stylesheet" href="index.iife.css" data-toncast-widget-css data-toncast-widget-css-loaded="true" />';
  const cssLink = `${iifeCssLink}${css ? `\n    <link rel="stylesheet" href="style.css" />` : ""}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(config.appName || "Toncast Widget")}</title>${cssLink}
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html {
        min-height: 100%;
        min-height: 100vh;
        min-height: 100svh;
        min-height: 100dvh;
        color-scheme: ${rootColorScheme};
        background: ${bodyBackground};
        overflow-x: hidden;
      }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        min-height: 100%;
        min-height: 100vh;
        min-height: 100svh;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
        background: ${bodyBackground};
        overflow-x: hidden;
      }${systemDarkCss}
      #toncast-widget {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        max-width: 100%;
      }
    </style>
  </head>
  <body>
    <div id="toncast-widget"></div>

    <script src="${WIDGET_CDN_JS_URL}"></script>
    <script>
      const widget = new window.ToncastWidget.ToncastWidget(${stringifyForScript(widgetConfig, 6).replace(/^/gm, "      ").trimStart()});
      widget.mount(document.getElementById('toncast-widget'));
    </script>
  </body>
</html>
`;
}

export function buildJsSnippet(config: ConstructorConfig): string {
  const domain = stripTrailingSlashes(config.domain || PLACEHOLDER_DOMAIN);
  const widgetConfig = buildWidgetConfig(config, { domain });

  return `<div id="toncast-widget"></div>

<script src="${WIDGET_CDN_JS_URL}"></script>
<script>
  const widget = new window.ToncastWidget.ToncastWidget(${stringifyForScript(widgetConfig, 4).replace(/\n/g, "\n  ")});
  widget.mount(document.getElementById('toncast-widget'));
</script>`;
}

export function buildReactSnippet(config: ConstructorConfig): string {
  // React snippet emits `tonconnect: { type: 'integrated', instance: tonconnect }`,
  // so standalone tonconnect from buildWidgetConfig is discarded; reuse client/widget.
  const built = buildWidgetConfig(config, { integratedMode: true });
  const widgetPart = built.widget
    ? `,\n        widget: ${stringifyForScript(built.widget, 8).replace(/\n/g, "\n        ")}`
    : "";
  const clientPart = built.client
    ? `,\n          client: ${stringifyForScript(built.client, 10).replace(/\n/g, "\n          ")}`
    : "";

  return `// NOTE: ToncastBettingWidget must be rendered inside a TonConnectUIProvider.
// See https://docs.ton.org/develop/dapps/ton-connect/web for setup instructions.
import { useEffect, useRef } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import ToncastWidgetLoader from '@toncast/widget-loader';

function ToncastBettingWidget() {
  const [tonconnect] = useTonConnectUI();
  const ref = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<InstanceType<Awaited<ReturnType<typeof ToncastWidgetLoader.load>>> | null>(null);

  useEffect(() => {
    let active = true;
    ToncastWidgetLoader.load()
      .then((Widget) => {
        if (!active || !ref.current) return;
        widgetRef.current = new Widget({
          tonconnect: { type: 'integrated', instance: tonconnect }${clientPart}${widgetPart},
        });
        widgetRef.current.mount(ref.current);
      })
      .catch((err) => console.error('[ToncastWidget] load failed:', err));
    return () => { active = false; widgetRef.current?.unmount(); };
  }, [tonconnect]);

  return <div ref={ref} style={{ width: '100%' }} />;
}`;
}

export async function downloadZip(config: ConstructorConfig): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folder = zip.folder("toncast-widget");
  if (!folder) throw new Error("Failed to create zip folder");

  folder.file("index.html", buildIndexHtml(config));
  folder.file("index.iife.css", widgetIifeCss);
  folder.file("tonconnect-manifest.json", buildManifestJson(config));

  const css = buildStyleCss(config);
  if (css) folder.file("style.css", css);

  const blob = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "toncast-widget.zip";
    a.click();
  } finally {
    setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      OBJECT_URL_REVOKE_DELAY_MS,
    );
  }
}
