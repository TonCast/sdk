import JSZip from "jszip";
import type { ConstructorConfig } from "../types";

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
  const hasOverrides = theme.accent !== "#0098ea" || theme.bg !== "" || theme.radius !== 12;
  if (!hasOverrides) return null;

  const lines: string[] = ["#toncast-widget {"];
  if (theme.accent !== "#0098ea") {
    lines.push(`  --tc-accent: ${theme.accent};`);
    lines.push(`  --tc-accent-hover: ${theme.accent};`);
  }
  if (theme.bg) lines.push(`  --tc-bg: ${theme.bg};`);
  if (theme.radius !== 12) lines.push(`  --tc-radius: ${theme.radius}px;`);
  lines.push("}");

  return lines.join("\n");
}

/** Builds the widget.cssVars object for JS/React configs. */
function buildCssVarsConfig(config: ConstructorConfig): Record<string, string> | undefined {
  const { theme } = config;
  const vars: Record<string, string> = {};
  if (theme.accent !== "#0098ea") {
    vars.accent = theme.accent;
    vars.accentHover = theme.accent;
  }
  if (theme.bg) vars.bg = theme.bg;
  if (theme.radius !== 12) vars.radius = `${theme.radius}px`;
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

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.appName || "Toncast Widget"}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: ${config.theme.colorScheme === "dark" ? "#0f172a" : "#f8fafc"};
      }
      #toncast-widget {
        width: 100%;
        max-width: 480px;
      }${css ? `\n      ${css.replace(/\n/g, "\n      ")}` : ""}
    </style>
  </head>
  <body>
    <div id="toncast-widget"></div>

    <script src="https://widget.toncast.app/v0/index.iife.js"></script>
    <script>
      const widget = new window.ToncastWidget.ToncastWidget(${JSON.stringify(widgetConfig, null, 6).replace(/^/gm, "      ").trimStart()});
      widget.mount(document.getElementById('toncast-widget'));
    </script>
  </body>
</html>
`;
}

export function buildJsSnippet(config: ConstructorConfig): string {
  const domain = config.domain || "https://your-domain.com";
  const widgetOptions = buildWidgetOptions(config);
  const widgetPart =
    Object.keys(widgetOptions).length > 0
      ? `\n    widget: ${JSON.stringify(widgetOptions, null, 4).replace(/\n/g, "\n    ")},`
      : "";

  return `<div id="toncast-widget"></div>

<script src="https://widget.toncast.app/v0/index.iife.js"></script>
<script>
  const widget = new window.ToncastWidget.ToncastWidget({
    tonconnect: {
      type: 'standalone',
      options: { domain: '${domain}' },
    },${widgetPart}
  });
  widget.mount(document.getElementById('toncast-widget'));
</script>`;
}

export function buildReactSnippet(config: ConstructorConfig): string {
  const widgetOptions = buildWidgetOptions(config);
  const widgetPart =
    Object.keys(widgetOptions).length > 0
      ? `,\n        widget: ${JSON.stringify(widgetOptions, null, 8).replace(/\n/g, "\n        ")}`
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
  URL.revokeObjectURL(url);
}
