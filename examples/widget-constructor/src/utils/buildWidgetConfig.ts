import type { ToncastWidgetConfig, ToncastWidgetLayout } from "@toncast/widget";
import { stripTrailingSlashes } from "@toncast/widget/url";
import type { ConstructorConfig } from "../types";
import { buildCssVarsConfig } from "./generateZip";
import { normalizeGridColumnForDevice } from "./themeRules";

interface BuildOpts {
  /** Pre-resolved absolute http(s) URL — caller decides fallback (DEV_DOMAIN, placeholder). */
  domain: string;
}

function buildLayout(config: ConstructorConfig): ToncastWidgetLayout {
  return {
    grid: {
      mobile: normalizeGridColumnForDevice("mobile", config.theme.grid.mobile),
      tablet: normalizeGridColumnForDevice("tablet", config.theme.grid.tablet),
      desktop: normalizeGridColumnForDevice("desktop", config.theme.grid.desktop),
    },
  };
}

function buildClient(config: ConstructorConfig): ToncastWidgetConfig["client"] | undefined {
  const baseUrl = stripTrailingSlashes(config.apiBaseUrl.trim());
  if (!baseUrl) return undefined;
  const wsUrl = stripTrailingSlashes(config.apiWsUrl.trim());
  return wsUrl ? { type: "standalone", baseUrl, wsUrl } : { type: "standalone", baseUrl };
}

function buildWidgetOptions(config: ConstructorConfig): NonNullable<ToncastWidgetConfig["widget"]> {
  const widget: NonNullable<ToncastWidgetConfig["widget"]> = {};
  if (config.language) widget.language = config.language;
  if (config.theme.colorScheme !== "light") widget.theme = config.theme.colorScheme;
  const cssVars = buildCssVarsConfig(config);
  if (cssVars) widget.cssVars = cssVars;
  widget.layout = buildLayout(config);
  if (config.referralAddress && config.referralPct > 0) {
    widget.referral = { address: config.referralAddress, pct: config.referralPct };
  }
  if (config.languages.length > 0) widget.languages = config.languages;
  return widget;
}

/**
 * Single source of truth for the runtime widget config object.
 *
 * Used by:
 * - HTML/JS/React snippet generators in `generateZip` (serialised to text);
 * - `LivePreview` (passed as a prop to <Widget/>).
 *
 * `tonconnect` is always emitted; `client` only when `apiBaseUrl` is non-empty
 * (optional `apiWsUrl` is included when set in the constructor).
 * `widget` is always emitted (includes responsive `layout`).
 */
export function buildWidgetConfig(config: ConstructorConfig, opts: BuildOpts): ToncastWidgetConfig {
  const out: ToncastWidgetConfig = {
    tonconnect: { type: "standalone", options: { domain: opts.domain } },
    widget: buildWidgetOptions(config),
  };
  const client = buildClient(config);
  if (client) out.client = client;
  return out;
}
