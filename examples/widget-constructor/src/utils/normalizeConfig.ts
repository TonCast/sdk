import { Address } from "@ton/core";
import { RADIUS_DEFAULT, RADIUS_MAX } from "@toncast/widget/constants";
import { parseHttpUrl, stripTrailingSlashes } from "@toncast/widget/url";
import { type ConstructorConfig, DEFAULT_CONFIG, type ThemeConfig } from "../types";

const VALID_DENSITIES: ThemeConfig["density"][] = ["compact", "default", "comfortable"];
const VALID_SCHEMES: ThemeConfig["colorScheme"][] = ["light", "dark", "system"];

function normalizeGridColumn(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(6, Math.max(1, Math.round(n))) : fallback;
}

/**
 * Clamps a radius value to [0, RADIUS_MAX]. Non-finite input falls back to
 * `fallback` (defaults to {@link RADIUS_DEFAULT} — the widget's default `--tc-radius`).
 *
 * Single source of truth used by `normalizeConfig`, `LivePreview`, and the
 * various code-generation paths in `generateZip`.
 */
export function clampRadius(raw: unknown, fallback = RADIUS_DEFAULT): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(RADIUS_MAX, Math.max(0, n)) : fallback;
}

/** Trim and require absolute http(s) URL — anything else collapses to empty string. */
export function normalizeDomain(raw: unknown): string {
  return parseHttpUrl(raw) ? stripTrailingSlashes((raw as string).trim()) : "";
}

/** Trim, require absolute http(s) URL, strip trailing slashes — empty otherwise. */
export function normalizeApiBaseUrl(raw: unknown): string {
  const url = parseHttpUrl(raw);
  return url ? stripTrailingSlashes((raw as string).trim()) : "";
}

/** Trim, require absolute ws(s) URL, strip trailing slashes — empty otherwise. */
export function normalizeApiWsUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "wss:" && url.protocol !== "ws:") return "";
  return stripTrailingSlashes(trimmed);
}

/** Trim, accept valid TON addresses only; normalise to non-bounceable user form (UQ…). */
export function normalizeReferralAddress(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  try {
    return Address.parse(s).toString({ bounceable: false, urlSafe: true });
  } catch {
    return "";
  }
}

/**
 * Coerces a persisted (possibly corrupt) config blob into a well-typed,
 * bounded ConstructorConfig. All optional-but-typed fields fall back to
 * `DEFAULT_CONFIG` when missing or invalid — the resulting object is always
 * safe to use without runtime guards in render paths.
 */
export function normalizeConfig(parsed: Partial<ConstructorConfig>): ConstructorConfig {
  const t = parsed.theme;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    languages: Array.isArray(parsed.languages) ? parsed.languages : DEFAULT_CONFIG.languages,
    apiBaseUrl: normalizeApiBaseUrl(parsed.apiBaseUrl),
    apiWsUrl: normalizeApiWsUrl(parsed.apiWsUrl),
    referralPct: Number.isFinite(Number(parsed.referralPct))
      ? Math.min(7, Math.max(0, Number(parsed.referralPct)))
      : DEFAULT_CONFIG.referralPct,
    domain: normalizeDomain(parsed.domain),
    referralAddress: normalizeReferralAddress(parsed.referralAddress),
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...t,
      colorScheme: VALID_SCHEMES.includes(t?.colorScheme as ThemeConfig["colorScheme"])
        ? (t?.colorScheme as ThemeConfig["colorScheme"])
        : DEFAULT_CONFIG.theme.colorScheme,
      density: VALID_DENSITIES.includes(t?.density as ThemeConfig["density"])
        ? (t?.density as ThemeConfig["density"])
        : DEFAULT_CONFIG.theme.density,
      radius: clampRadius(t?.radius, DEFAULT_CONFIG.theme.radius),
      grid: {
        mobile: normalizeGridColumn(t?.grid?.mobile, DEFAULT_CONFIG.theme.grid.mobile),
        tablet: normalizeGridColumn(t?.grid?.tablet, DEFAULT_CONFIG.theme.grid.tablet),
        desktop: normalizeGridColumn(t?.grid?.desktop, DEFAULT_CONFIG.theme.grid.desktop),
      },
      light: { ...DEFAULT_CONFIG.theme.light, ...(t?.light ?? {}) },
      dark: { ...DEFAULT_CONFIG.theme.dark, ...(t?.dark ?? {}) },
    },
  };
}
