import { Address } from "@ton/core";
import { SUPPORTED_LANGUAGES } from "@toncast/sdk";
import { RADIUS_DEFAULT, RADIUS_MAX } from "@toncast/widget/constants";
import { parseHttpUrl, stripTrailingSlashes } from "@toncast/widget/url";
import { type ConstructorConfig, DEFAULT_CONFIG, type ThemeConfig } from "../types";
import { normalizeGridColumnForDevice } from "./themeRules";

const VALID_DENSITIES = new Set<ThemeConfig["density"]>(["compact", "default", "comfortable"]);
const VALID_SCHEMES = new Set<ThemeConfig["colorScheme"]>(["light", "dark", "system"]);
const SUPPORTED_LANGUAGES_SET = new Set<string>(SUPPORTED_LANGUAGES);

function isValidDensity(v: unknown): v is ThemeConfig["density"] {
  return typeof v === "string" && VALID_DENSITIES.has(v as ThemeConfig["density"]);
}

function isValidScheme(v: unknown): v is ThemeConfig["colorScheme"] {
  return typeof v === "string" && VALID_SCHEMES.has(v as ThemeConfig["colorScheme"]);
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
  const rawLanguages = Array.isArray(parsed.languages)
    ? parsed.languages
    : DEFAULT_CONFIG.languages;
  const languages = rawLanguages.filter(
    (l): l is ConstructorConfig["languages"][number] =>
      typeof l === "string" && SUPPORTED_LANGUAGES_SET.has(l),
  );
  const rawLanguage = parsed.language;
  const language =
    typeof rawLanguage === "string" &&
    (rawLanguage === "" || SUPPORTED_LANGUAGES_SET.has(rawLanguage))
      ? (rawLanguage as ConstructorConfig["language"])
      : DEFAULT_CONFIG.language;
  return {
    domain: normalizeDomain(parsed.domain),
    appName: typeof parsed.appName === "string" ? parsed.appName : DEFAULT_CONFIG.appName,
    iconUrl: typeof parsed.iconUrl === "string" ? parsed.iconUrl : DEFAULT_CONFIG.iconUrl,
    languages,
    language,
    apiBaseUrl: normalizeApiBaseUrl(parsed.apiBaseUrl),
    apiWsUrl: normalizeApiWsUrl(parsed.apiWsUrl),
    referralAddress: normalizeReferralAddress(parsed.referralAddress),
    referralPct: Number.isFinite(Number(parsed.referralPct))
      ? Math.min(7, Math.max(0, Number(parsed.referralPct)))
      : DEFAULT_CONFIG.referralPct,
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...t,
      colorScheme: isValidScheme(t?.colorScheme) ? t.colorScheme : DEFAULT_CONFIG.theme.colorScheme,
      density: isValidDensity(t?.density) ? t.density : DEFAULT_CONFIG.theme.density,
      radius: clampRadius(t?.radius, DEFAULT_CONFIG.theme.radius),
      grid: {
        mobile: normalizeGridColumnForDevice("mobile", t?.grid?.mobile),
        tablet: normalizeGridColumnForDevice("tablet", t?.grid?.tablet),
        desktop: normalizeGridColumnForDevice("desktop", t?.grid?.desktop),
      },
      light: { ...DEFAULT_CONFIG.theme.light, ...(t?.light ?? {}) },
      dark: { ...DEFAULT_CONFIG.theme.dark, ...(t?.dark ?? {}) },
    },
  };
}
