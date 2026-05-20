import { safeHexColor } from "@toncast/widget/color-math";
import { stripTrailingSlashes } from "@toncast/widget/url";
import { WIDGET_CDN_JS_URL } from "@toncast/widget-loader";
import type { ConstructorConfig } from "../types";
import { buildWidgetConfig, PLACEHOLDER_DOMAIN } from "./buildWidgetConfig";
import { escapeHtml } from "./manifest";
import { HOST_PAGE_BACKDROP } from "./themeDefaults";

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

/** Resolves host page backdrop colors from optional theme shell `bg` values. */
export function resolveHostBackdropColors(config: ConstructorConfig): {
  light: string;
  dark: string;
} {
  const lightRaw = config.theme.light.bg?.trim();
  const darkRaw = config.theme.dark.bg?.trim();
  return {
    light: (lightRaw && safeHexColor(lightRaw)) || HOST_PAGE_BACKDROP.light,
    dark: (darkRaw && safeHexColor(darkRaw)) || HOST_PAGE_BACKDROP.dark,
  };
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

  const { rootColorScheme, bodyBackground, systemDarkCss } =
    buildHostShellBackdropCss(config);

  const iifeCssLink =
    '\n    <link rel="stylesheet" href="index.iife.css" data-toncast-widget-css />';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(config.appName || "Toncast Widget")}</title>${iifeCssLink}
    <style>
      /* Minimal shell: fill viewport; widget is the only flex child and grows. */
      html {
        height: 100%;
        min-height: 100vh;
        min-height: 100dvh;
        color-scheme: ${rootColorScheme};
        background: ${bodyBackground};
      }
      body {
        margin: 0;
        box-sizing: border-box;
        height: 100%;
        /* Horizontal safe-area omitted so the widget can span edge-to-edge like a normal page. */
        padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px) 0;
        display: flex;
        flex-direction: column;
        background: ${bodyBackground};
      }${systemDarkCss}
      #toncast-widget {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        --tc-shell-radius: 0;
        --tc-shell-border: none;
        --tc-content-padding: 0;
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
  // buildWidgetConfig with integratedMode only populates .widget / .client.
  // The generated snippet replaces tonconnect with its own useTonConnectUI() instance.
  const built = buildWidgetConfig(config, { integratedMode: true });
  const widgetPart = built.widget
    ? `,\n        widget: ${stringifyForScript(built.widget, 8).replace(/\n/g, "\n        ")}`
    : "";
  const clientPart = built.client
    ? `,\n          client: ${stringifyForScript(built.client, 10).replace(/\n/g, "\n          ")}`
    : "";

  return `// NOTE: ToncastBettingWidget must be rendered inside a TonConnectUIProvider.
// Theme is applied via widget.cssVars in the config below.
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
    return () => { active = false; widgetRef.current?.dispose(); };
  }, [tonconnect]);

  return <div ref={ref} style={{ width: '100%' }} />;
}`;
}
