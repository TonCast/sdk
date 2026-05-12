import type { ToncastWidgetConfig, ToncastWidgetLayout } from "@toncast/widget";
import { stripTrailingSlashes } from "@toncast/widget/url";
import type { ConstructorConfig } from "../types";
import { buildCssVarsConfig } from "./generateZip";

interface BuildOpts {
  /** Pre-resolved absolute http(s) URL — caller decides fallback (DEV_DOMAIN, placeholder). */
  domain: string;
}

function normalizeGridColumn(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(6, Math.round(value))) : fallback;
}

function buildLayout(config: ConstructorConfig): ToncastWidgetLayout {
  return {
    grid: {
      mobile: normalizeGridColumn(config.theme.grid.mobile, 1),
      tablet: normalizeGridColumn(config.theme.grid.tablet, 2),
      desktop: normalizeGridColumn(config.theme.grid.desktop, 3),
    },
  };
}

function buildClient(config: ConstructorConfig): ToncastWidgetConfig["client"] | undefined {
  const baseUrl = stripTrailingSlashes(config.apiBaseUrl.trim());
  if (!baseUrl) return undefined;
  return { type: "standalone", baseUrl };
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
 * `tonconnect` is always emitted; `client` only when `apiBaseUrl` is non-empty.
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
