import type { ConstructorConfig } from "../types";
import { buildCssVarsConfig } from "./generateZip";

export interface BuiltWidgetConfig {
  tonconnect: { type: "standalone"; options: { domain: string } };
  client?: { type: "standalone"; baseUrl: string };
  widget?: Record<string, unknown>;
}

interface BuildOpts {
  /** Pre-resolved absolute http(s) URL — caller decides fallback (DEV_DOMAIN, placeholder). */
  domain: string;
}

function normalizeGridColumn(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(6, Math.round(value))) : fallback;
}

function buildLayout(config: ConstructorConfig) {
  return {
    grid: {
      mobile: normalizeGridColumn(config.theme.grid.mobile, 1),
      tablet: normalizeGridColumn(config.theme.grid.tablet, 2),
      desktop: normalizeGridColumn(config.theme.grid.desktop, 3),
    },
  };
}

function buildClient(config: ConstructorConfig): BuiltWidgetConfig["client"] | undefined {
  const baseUrl = config.apiBaseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) return undefined;
  return { type: "standalone", baseUrl };
}

function buildWidgetOptions(config: ConstructorConfig): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (config.language) opts.language = config.language;
  if (config.theme.colorScheme !== "light") opts.theme = config.theme.colorScheme;
  const cssVars = buildCssVarsConfig(config);
  if (cssVars) opts.cssVars = cssVars;
  opts.layout = buildLayout(config);
  if (config.referralAddress && config.referralPct > 0) {
    opts.referral = { address: config.referralAddress, pct: config.referralPct };
  }
  if (config.languages.length > 0) opts.languages = config.languages;
  return opts;
}

/**
 * Single source of truth for the runtime widget config object.
 *
 * Used by:
 * - HTML/JS/React snippet generators in `generateZip` (serialised to text);
 * - `LivePreview` (passed as a prop to <Widget/>).
 *
 * `tonconnect` is always emitted; `client` and `widget` only when there is
 * something to emit (avoids spurious empty `{}` in the output).
 */
export function buildWidgetConfig(config: ConstructorConfig, opts: BuildOpts): BuiltWidgetConfig {
  const out: BuiltWidgetConfig = {
    tonconnect: { type: "standalone", options: { domain: opts.domain } },
  };
  const client = buildClient(config);
  if (client) out.client = client;
  const widget = buildWidgetOptions(config);
  if (Object.keys(widget).length > 0) out.widget = widget;
  return out;
}
