import type { ConstructorConfig } from "../types";

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

/** Builds optional host CSS overrides for the widget container. */
export function buildStyleCss(config: ConstructorConfig): string | null {
  const { theme } = config;
  const accent = safeHexColor(theme.accent);
  const bg = theme.bg ? safeHexColor(theme.bg) : null;
  const radius = Number.isFinite(theme.radius) ? Math.max(0, Math.min(64, theme.radius)) : 12;
  const hasOverrides = (accent !== null && accent !== "#0098ea") || bg !== null || radius !== 12;
  if (!hasOverrides) return null;

  const lines: string[] = ["#toncast-widget {"];
  if (accent !== null && accent !== "#0098ea") {
    lines.push(`  --tc-accent: ${accent};`);
    lines.push(`  --tc-accent-hover: ${accent};`);
  }
  if (bg !== null) lines.push(`  --tc-bg: ${bg};`);
  if (radius !== 12) lines.push(`  --tc-radius: ${radius}px;`);
  lines.push("}");

  return lines.join("\n");
}

/** Builds the widget.cssVars object for JS/React configs. */
function buildCssVarsConfig(config: ConstructorConfig): Record<string, string> | undefined {
  const { theme } = config;
  const accent = safeHexColor(theme.accent);
  const bg = theme.bg ? safeHexColor(theme.bg) : null;
  const radius = Number.isFinite(theme.radius) ? Math.max(0, Math.min(64, theme.radius)) : 12;
  const vars: Record<string, string> = {};
  if (accent !== null && accent !== "#0098ea") {
    vars.accent = accent;
    vars.accentHover = accent;
  }
  if (bg !== null) vars.bg = bg;
  if (radius !== 12) vars.radius = `${radius}px`;
  return Object.keys(vars).length > 0 ? vars : undefined;
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
  // Default body background — for "system" we start with light and override in a media query below.
  const bodyBackground = isDark ? bodyBgDark : bodyBgLight;
  // Separate @media rule for "system" — must not be nested inside another rule.
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
  // Delay revocation to let the browser start the download before the URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
