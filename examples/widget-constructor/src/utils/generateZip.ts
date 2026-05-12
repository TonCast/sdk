import type { ToncastWidgetCssVarsBase } from "@toncast/widget";
import { safeHexColor } from "@toncast/widget/color-math";
import { deriveCssVars } from "@toncast/widget/css-vars-builder";
import {
  densityPresetToCssCustomProperties,
  WIDGET_DENSITY_PRESETS,
} from "@toncast/widget/density-presets";
import widgetIifeCss from "../../../../packages/widget/src/styles/widget.css?raw";
import {
  type ConstructorConfig,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  type ThemeColorSet,
} from "../types";
import { buildWidgetConfig } from "./buildWidgetConfig";

const WIDGET_CDN_JS_URL = "https://widget.toncast.app/v0/index.iife.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stringifyForScript(value: unknown, space: number): string {
  return JSON.stringify(value, null, space)
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
  if (success !== null && success !== defaults.success) palette.success = success;
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

/** Builds tonconnect-manifest.json content. */
export function buildManifestJson(config: ConstructorConfig): string {
  const cleanDomain = (config.domain || "https://your-domain.com").replace(/\/$/, "");
  return JSON.stringify(
    {
      url: cleanDomain,
      name: config.appName || "My App",
      iconUrl: config.iconUrl || `${cleanDomain}/icon-192.png`,
    },
    null,
    2,
  );
}

/** Returns a CSS vars sub-object for a given color set, or null if no overrides. */
function colorSetVars(
  colors: ThemeColorSet,
  defaults: ThemeColorSet,
): Record<string, string> | null {
  const vars: Record<string, string> = {};
  const accent = safeHexColor(colors.accent);
  const bg = colors.bg ? safeHexColor(colors.bg) : null;
  const success = safeHexColor(colors.success);
  const danger = safeHexColor(colors.danger);
  const warn = safeHexColor(colors.warn);
  if (accent !== null && accent !== defaults.accent) {
    vars.accent = accent;
  }
  if (bg !== null) vars.bg = bg;
  if (success !== null && success !== defaults.success) vars.success = success;
  if (danger !== null && danger !== defaults.danger) vars.danger = danger;
  if (warn !== null && warn !== defaults.warn) vars.warn = warn;
  return Object.keys(vars).length > 0 ? vars : null;
}

const HOST_BACKDROP_LIGHT = "#f8fafc";
const HOST_BACKDROP_DARK = "#0f172a";

/**
 * Page mat behind the widget in Live Preview / export: uses optional shell bg
 * when set, otherwise the same defaults as the widget (`--tc-bg` light/dark).
 */
export function previewBackdropFromConfig(config: ConstructorConfig, prefersDark: boolean): string {
  const lightRaw = config.theme.light.bg?.trim();
  const darkRaw = config.theme.dark.bg?.trim();
  const lightBody = (lightRaw && safeHexColor(lightRaw)) || HOST_BACKDROP_LIGHT;
  const darkBody = (darkRaw && safeHexColor(darkRaw)) || HOST_BACKDROP_DARK;
  if (config.theme.colorScheme === "dark") return darkBody;
  if (config.theme.colorScheme === "light") return lightBody;
  return prefersDark ? darkBody : lightBody;
}

/**
 * Builds the widget.cssVars object for JS/React configs.
 * Exported so LivePreview can reuse without duplicating the logic.
 */
export function buildCssVarsConfig(config: ConstructorConfig): Record<string, unknown> | undefined {
  const { theme } = config;
  const radius = Number.isFinite(theme.radius) ? Math.max(0, Math.min(64, theme.radius)) : 12;

  const vars: Record<string, unknown> = {};

  // Base radius (applies to both themes)
  if (radius !== 12) vars.radius = `${radius}px`;

  if (theme.density !== "default") vars.density = theme.density;

  // Per-theme color overrides
  const lightVars = colorSetVars(theme.light, DEFAULT_LIGHT_COLORS);
  const darkVars = colorSetVars(theme.dark, DEFAULT_DARK_COLORS);

  if (theme.colorScheme === "light") {
    // Only light mode active — put vars at base level (simpler output)
    if (lightVars) Object.assign(vars, lightVars);
  } else if (theme.colorScheme === "dark") {
    // Only dark mode active — put vars at base level
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
  const radius = Number.isFinite(theme.radius) ? Math.max(0, Math.min(64, theme.radius)) : 12;

  const baseLines: string[] = [];
  if (radius !== 12) baseLines.push(`  --tc-radius: ${radius}px;`);
  // Emit density spacing tokens (same presets as @toncast/widget WIDGET_DENSITY_PRESETS).
  if (theme.density !== "default") {
    const preset = WIDGET_DENSITY_PRESETS[theme.density];
    const densityVars = densityPresetToCssCustomProperties(preset);
    for (const [k, v] of Object.entries(densityVars)) baseLines.push(`  ${k}: ${v};`);
  }

  const lightLines: string[] = [];
  if (theme.colorScheme !== "dark") {
    appendPaletteCssVars(lightLines, theme.light, DEFAULT_LIGHT_COLORS, "light");
  }

  const darkLines: string[] = [];
  if (theme.colorScheme !== "light") {
    appendPaletteCssVars(darkLines, theme.dark, DEFAULT_DARK_COLORS, "dark");
  }

  const hasOverrides = baseLines.length > 0 || lightLines.length > 0 || darkLines.length > 0;
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

const PLACEHOLDER_DOMAIN = "https://your-domain.com";

export function buildIndexHtml(config: ConstructorConfig): string {
  // Empty domain would break TonConnect (invalid manifest URL).
  const domain = (config.domain || PLACEHOLDER_DOMAIN).replace(/\/$/, "");
  const widgetConfig = buildWidgetConfig(config, { domain });

  const css = buildStyleCss(config);

  const isSystem = config.theme.colorScheme === "system";
  const isDark = config.theme.colorScheme === "dark";
  const lightRaw = config.theme.light.bg?.trim();
  const darkRaw = config.theme.dark.bg?.trim();
  const bodyBgLight = (lightRaw && safeHexColor(lightRaw)) || HOST_BACKDROP_LIGHT;
  const bodyBgDark = (darkRaw && safeHexColor(darkRaw)) || HOST_BACKDROP_DARK;
  const bodyBackground = isDark ? bodyBgDark : bodyBgLight;
  const systemDarkCss = isSystem
    ? `\n      @media (prefers-color-scheme: dark) {\n        body { background: ${bodyBgDark}; }\n      }`
    : "";

  const iifeCssLink =
    '\n    <link rel="stylesheet" href="index.iife.css" data-toncast-widget-css data-toncast-widget-css-loaded="true" />';
  const cssLink = `${iifeCssLink}${css ? `\n    <link rel="stylesheet" href="style.css" />` : ""}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(config.appName || "Toncast Widget")}</title>${cssLink}
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 24px 16px;
        background: ${bodyBackground};
      }${systemDarkCss}
      #toncast-widget {
        width: min(100%, 920px);
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
  const domain = config.domain || PLACEHOLDER_DOMAIN;
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
  // so we ignore tonconnect from buildWidgetConfig but reuse client/widget.
  const built = buildWidgetConfig(config, { domain: "" });
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "toncast-widget.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
