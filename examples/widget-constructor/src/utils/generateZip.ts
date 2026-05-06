import JSZip from "jszip";
import type { ConstructorConfig } from "../types";

export function buildManifestJson(domain: string): string {
  const cleanDomain = domain.replace(/\/$/, "");
  return JSON.stringify(
    {
      url: cleanDomain,
      name: "My App",
      iconUrl: `${cleanDomain}/icon-192.png`,
    },
    null,
    2,
  );
}

export function buildStyleCss(config: ConstructorConfig): string | null {
  const { theme } = config;
  const hasOverrides =
    theme.accent !== "#0098ea" ||
    theme.bg !== "" ||
    theme.radius !== 12 ||
    theme.colorScheme !== "light";

  if (!hasOverrides) return null;

  const lines: string[] = ["#toncast-widget {"];
  if (theme.accent !== "#0098ea") lines.push(`  --tc-accent: ${theme.accent};`);
  if (theme.bg) lines.push(`  --tc-bg: ${theme.bg};`);
  if (theme.radius !== 12) lines.push(`  --tc-radius: ${theme.radius}px;`);
  lines.push("}");

  if (theme.colorScheme === "dark") {
    lines.push("", "#toncast-widget {", "  /* dark mode applied via widget config */", "}");
  }

  return lines.join("\n");
}

export function buildIndexHtml(config: ConstructorConfig): string {
  const domain = config.domain.replace(/\/$/, "");
  const widgetConfig: Record<string, unknown> = {
    tonconnect: {
      type: "standalone",
      options: { domain },
    },
  };

  const widgetOptions: Record<string, unknown> = {};
  if (config.language) widgetOptions.language = config.language;
  if (config.theme.colorScheme !== "light") widgetOptions.theme = config.theme.colorScheme;
  if (config.referralAddress && config.referralPct > 0) {
    widgetOptions.referral = { address: config.referralAddress, pct: config.referralPct };
  }
  if (config.languages.length > 0) widgetOptions.languages = config.languages;
  if (Object.keys(widgetOptions).length > 0) widgetConfig.widget = widgetOptions;

  const css = buildStyleCss(config);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Toncast Widget</title>
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

export async function downloadZip(config: ConstructorConfig): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder("toncast-widget");
  if (!folder) throw new Error("Failed to create zip folder");

  folder.file("index.html", buildIndexHtml(config));
  folder.file("tonconnect-manifest.json", buildManifestJson(config.domain));

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

export function buildJsSnippet(config: ConstructorConfig): string {
  const domain = config.domain || "https://your-domain.com";
  const widgetOptions: Record<string, unknown> = {};
  if (config.language) widgetOptions.language = config.language;
  if (config.theme.colorScheme !== "light") widgetOptions.theme = config.theme.colorScheme;
  if (config.referralAddress && config.referralPct > 0) {
    widgetOptions.referral = { address: config.referralAddress, pct: config.referralPct };
  }
  if (config.languages.length > 0) widgetOptions.languages = config.languages;

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
