import { DEFAULT_ACCENT, type ConstructorConfig, type ThemeColorSet } from "../types";

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

function safeHexColor(value: string): string | null {
  const trimmed = value.trim();
  return /^#[\da-fA-F]{3,8}$/.test(trimmed) ? trimmed : null;
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
  defaultAccent = DEFAULT_ACCENT,
): Record<string, string> | null {
  const vars: Record<string, string> = {};
  const accent = safeHexColor(colors.accent);
  const bg = colors.bg ? safeHexColor(colors.bg) : null;
  if (accent !== null && accent !== defaultAccent) {
    vars.accent = accent;
    vars.accentHover = accent;
  }
  if (bg !== null) vars.bg = bg;
  return Object.keys(vars).length > 0 ? vars : null;
}

/** Returns gridCols CSS value for the selected column count (null = auto/default). */
function gridColsValue(columns: number): string | null {
  if (!columns || columns < 1) return null;
  return `repeat(${columns}, 1fr)`;
}

/**
 * Builds the widget.cssVars object for JS/React configs.
 * Exported so LivePreview can reuse without duplicating the logic.
 */
export function buildCssVarsConfig(
  config: ConstructorConfig,
): Record<string, unknown> | undefined {
  const { theme } = config;
  const radius = Number.isFinite(theme.radius) ? Math.max(0, Math.min(64, theme.radius)) : 12;
  const gridCols = gridColsValue(theme.columns);

  const vars: Record<string, unknown> = {};

  // Base radius (applies to both themes)
  if (radius !== 12) vars.radius = `${radius}px`;

  // Grid columns (applies globally)
  if (gridCols) vars.gridCols = gridCols;

  // Per-theme color overrides
  const lightVars = colorSetVars(theme.light);
  const darkVars = colorSetVars(theme.dark);

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

  const lightAccent = safeHexColor(theme.light.accent);
  const lightBg = theme.light.bg ? safeHexColor(theme.light.bg) : null;
  const darkAccent = safeHexColor(theme.dark.accent);
  const darkBg = theme.dark.bg ? safeHexColor(theme.dark.bg) : null;

  const baseLines: string[] = [];
  if (radius !== 12) baseLines.push(`  --tc-radius: ${radius}px;`);
  if (gridCols) baseLines.push(`  --tc-grid-cols: ${gridCols};`);

  const lightLines: string[] = [];
  if (
    theme.colorScheme !== "dark" &&
    lightAccent !== null &&
    lightAccent !== DEFAULT_ACCENT
  ) {
    lightLines.push(`  --tc-accent: ${lightAccent};`);
    lightLines.push(`  --tc-accent-hover: ${lightAccent};`);
  }
  if (theme.colorScheme !== "dark" && lightBg !== null) {
    lightLines.push(`  --tc-bg: ${lightBg};`);
  }

  const darkLines: string[] = [];
  if (
    theme.colorScheme !== "light" &&
    darkAccent !== null &&
    darkAccent !== DEFAULT_ACCENT
  ) {
    darkLines.push(`  --tc-accent: ${darkAccent};`);
    darkLines.push(`  --tc-accent-hover: ${darkAccent};`);
  }
  if (theme.colorScheme !== "light" && darkBg !== null) {
    darkLines.push(`  --tc-bg: ${darkBg};`);
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
  const domain = config.domain.replace(/\/$/, "");
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

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(config.appName || "Toncast Widget")}</title>
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
      }${css ? `\n      ${css.replace(/\n/g, "\n      ")}` : ""}
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

  return `import { useEffect, useRef } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import ToncastWidgetLoader from '@toncast/widget-loader';

function ToncastBettingWidget() {
  const [tonconnect] = useTonConnectUI();
  const ref = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    let active = true;
    ToncastWidgetLoader.load().then((Widget) => {
      if (!active || !ref.current) return;
      widgetRef.current = new Widget({
        tonconnect: { type: 'integrated', instance: tonconnect }${widgetPart},
      });
      widgetRef.current.mount(ref.current);
    });
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
