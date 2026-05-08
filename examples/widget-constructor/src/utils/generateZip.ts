import { mix, parseHexColor, readableFg, rgba, safeHexColor } from "@toncast/widget/color-math";
import {
  densityPresetToCssCustomProperties,
  WIDGET_DENSITY_PRESETS,
} from "@toncast/widget/density-presets";
import {
  type ConstructorConfig,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  type ThemeColorSet,
} from "../types";

const WIDGET_CDN_URL = "https://widget.toncast.app/v0/index.iife.js";

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

function appendVar(lines: string[], name: string, value: string | null | undefined): void {
  if (value) lines.push(`  ${name}: ${value};`);
}

function appendSemanticCssVars(
  lines: string[],
  prefix: "success" | "danger" | "warn",
  source: string,
  theme: "light" | "dark",
): void {
  const textMixTarget: [number, number, number] = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
  const textWeight = theme === "dark" ? 0.18 : 0.2;
  appendVar(lines, `--tc-${prefix}`, source);
  appendVar(lines, `--tc-${prefix}-fg`, mix(source, textMixTarget, textWeight));
  appendVar(lines, `--tc-${prefix}-bg`, rgba(source, theme === "dark" ? 0.16 : 0.1));
  appendVar(lines, `--tc-${prefix}-border`, rgba(source, theme === "dark" ? 0.34 : 0.25));
  if (prefix !== "warn") {
    appendVar(lines, `--tc-${prefix}-hover-bg`, rgba(source, theme === "dark" ? 0.24 : 0.18));
    appendVar(lines, `--tc-${prefix}-active-bg`, rgba(source, theme === "dark" ? 0.3 : 0.22));
    appendVar(lines, `--tc-${prefix}-active-border`, rgba(source, 0.4));
    appendVar(lines, `--tc-${prefix}-fill-bg`, rgba(source, theme === "dark" ? 0.44 : 0.35));
    const shadow = rgba(source, 0.35);
    if (shadow) lines.push(`  --tc-${prefix}-active-shadow: 0 4px 12px -4px ${shadow};`);
  }
}

function appendPaletteCssVars(
  lines: string[],
  colors: ThemeColorSet,
  defaults: ThemeColorSet,
  theme: "light" | "dark",
): void {
  const accent = safeHexColor(colors.accent);
  const bg = colors.bg ? safeHexColor(colors.bg) : null;
  const success = safeHexColor(colors.success);
  const danger = safeHexColor(colors.danger);
  const warn = safeHexColor(colors.warn);

  if (accent !== null && accent !== defaults.accent) {
    appendVar(lines, "--tc-accent", accent);
    appendVar(lines, "--tc-accent-fg", readableFg(accent));
    appendVar(lines, "--tc-accent-bg", rgba(accent, theme === "dark" ? 0.18 : 0.1));
    const accentHoverTarget: [number, number, number] =
      theme === "dark" ? [255, 255, 255] : [0, 0, 0];
    appendVar(lines, "--tc-accent-hover", mix(accent, accentHoverTarget, 0.1) ?? accent);
    const shadow = rgba(accent, 0.55);
    if (shadow) lines.push(`  --tc-accent-shadow: 0 8px 24px -8px ${shadow};`);
  }
  if (bg !== null) {
    const fg = readableFg(bg);
    if (fg) {
      const darkBg = fg === "#ffffff";
      const surfaceTarget: [number, number, number] = darkBg ? [255, 255, 255] : [15, 23, 42];
      appendVar(lines, "--tc-bg", bg);
      appendVar(lines, "--tc-fg", fg);
      appendVar(lines, "--tc-fg-muted", mix(fg, parseHexColor(bg) ?? [0, 0, 0], 0.38));
      appendVar(lines, "--tc-bg-chrome", mix(bg, surfaceTarget, darkBg ? 0.1 : 0.04));
      appendVar(lines, "--tc-bg-card", mix(bg, surfaceTarget, darkBg ? 0.08 : 0.025));
      appendVar(lines, "--tc-bg-muted", mix(bg, surfaceTarget, darkBg ? 0.12 : 0.06));
      appendVar(lines, "--tc-border", rgba(fg, darkBg ? 0.16 : 0.12));
      appendVar(lines, "--tc-bg-hover", rgba(fg, darkBg ? 0.08 : 0.04));
    }
  }
  if (success !== null && success !== defaults.success) {
    appendSemanticCssVars(lines, "success", success, theme);
  }
  if (danger !== null && danger !== defaults.danger) {
    appendSemanticCssVars(lines, "danger", danger, theme);
  }
  if (warn !== null && warn !== defaults.warn) {
    appendSemanticCssVars(lines, "warn", warn, theme);
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

/** Returns gridCols CSS value for the selected column count (null = auto/default). */
function gridColsValue(columns: number): string | null {
  if (!columns || columns < 1) return null;
  const safeColumns = Math.max(1, Math.min(4, Math.trunc(columns)));
  const totalDefaultGap = Math.max(0, safeColumns - 1) * 10;
  return `repeat(auto-fit, minmax(max(180px, calc((100% - ${totalDefaultGap}px) / ${safeColumns})), 1fr))`;
}

/**
 * Builds the widget.cssVars object for JS/React configs.
 * Exported so LivePreview can reuse without duplicating the logic.
 */
export function buildCssVarsConfig(config: ConstructorConfig): Record<string, unknown> | undefined {
  const { theme } = config;
  const radius = Number.isFinite(theme.radius) ? Math.max(0, Math.min(64, theme.radius)) : 12;
  const gridCols = gridColsValue(theme.columns);

  const vars: Record<string, unknown> = {};

  // Base radius (applies to both themes)
  if (radius !== 12) vars.radius = `${radius}px`;

  // Grid columns (applies globally)
  if (gridCols) vars.gridCols = gridCols;
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
  const gridCols = gridColsValue(theme.columns);

  const baseLines: string[] = [];
  if (radius !== 12) baseLines.push(`  --tc-radius: ${radius}px;`);
  if (gridCols) baseLines.push(`  --tc-grid-cols: ${gridCols};`);
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

/** Shared helper — builds the widget options object from constructor config. */
function buildWidgetOptions(config: ConstructorConfig): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (config.language) opts.language = config.language;
  if (config.theme.colorScheme !== "light") opts.theme = config.theme.colorScheme;
  const cssVars = buildCssVarsConfig(config);
  if (cssVars) opts.cssVars = cssVars;
  if (config.referralAddress && config.referralPct > 0) {
    opts.referral = { address: config.referralAddress, pct: config.referralPct };
  }
  if (config.languages.length > 0) opts.languages = config.languages;
  return opts;
}

export function buildIndexHtml(config: ConstructorConfig): string {
  // Match buildJsSnippet: empty domain would break TonConnect (invalid manifest URL).
  const domain = (config.domain || "https://your-domain.com").replace(/\/$/, "");
  const widgetOptions = buildWidgetOptions(config);
  const widgetConfig: Record<string, unknown> = {
    tonconnect: { type: "standalone", options: { domain } },
  };
  if (Object.keys(widgetOptions).length > 0) widgetConfig.widget = widgetOptions;

  const css = buildStyleCss(config);

  const isSystem = config.theme.colorScheme === "system";
  const isDark = config.theme.colorScheme === "dark";
  const bodyBgLight = "#f8fafc";
  const bodyBgDark = "#0f172a";
  const bodyBackground = isDark ? bodyBgDark : bodyBgLight;
  const systemDarkCss = isSystem
    ? `\n      @media (prefers-color-scheme: dark) {\n        body { background: ${bodyBgDark}; }\n      }`
    : "";

  // style.css (when non-empty) is written as a separate file in the ZIP and
  // referenced via <link> so integrators can locate and edit it in one place.
  const cssLink = css ? `\n    <link rel="stylesheet" href="style.css" />` : "";

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
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: ${bodyBackground};
      }${systemDarkCss}
      #toncast-widget {
        width: 100%;
        max-width: 480px;
      }
    </style>
  </head>
  <body>
    <div id="toncast-widget"></div>

    <script src="${WIDGET_CDN_URL}"></script>
    <script>
      const widget = new window.ToncastWidget.ToncastWidget(${stringifyForScript(widgetConfig, 6).replace(/^/gm, "      ").trimStart()});
      widget.mount(document.getElementById('toncast-widget'));
    </script>
  </body>
</html>
`;
}

export function buildJsSnippet(config: ConstructorConfig): string {
  const domain = config.domain || "https://your-domain.com";
  const widgetOptions = buildWidgetOptions(config);
  const widgetConfig: Record<string, unknown> = {
    tonconnect: {
      type: "standalone",
      options: { domain },
    },
  };
  if (Object.keys(widgetOptions).length > 0) widgetConfig.widget = widgetOptions;

  return `<div id="toncast-widget"></div>

<script src="${WIDGET_CDN_URL}"></script>
<script>
  const widget = new window.ToncastWidget.ToncastWidget(${stringifyForScript(widgetConfig, 4).replace(/\n/g, "\n  ")});
  widget.mount(document.getElementById('toncast-widget'));
</script>`;
}

export function buildReactSnippet(config: ConstructorConfig): string {
  const widgetOptions = buildWidgetOptions(config);
  const widgetPart =
    Object.keys(widgetOptions).length > 0
      ? `,\n        widget: ${stringifyForScript(widgetOptions, 8).replace(/\n/g, "\n        ")}`
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
          tonconnect: { type: 'integrated', instance: tonconnect }${widgetPart},
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
