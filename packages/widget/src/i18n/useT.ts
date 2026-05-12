import type { SupportedLanguage } from "@toncast/sdk";
import { useCallback } from "react";
import { useI18n } from "./I18nProvider";
import { EN_CATALOG, TRANSLATIONS, type TranslationKey } from "./translations";

type TParams = Record<string, string | number>;

/**
 * Pure templating: substitutes `{name}` placeholders. Missing params are kept
 * as `{name}` so the developer can spot typos in the rendered output.
 */
export function applyTranslation(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

/**
 * Pure lookup: pick localised string for `key`, fall back to English, then
 * to the raw key (so a missing/future SDK enum value yields a readable string).
 */
export function pickTranslation(lang: SupportedLanguage, key: TranslationKey): string {
  return TRANSLATIONS[lang]?.[key] ?? EN_CATALOG[key] ?? key;
}

export function useT(): (key: TranslationKey, params?: TParams) => string {
  const { lang } = useI18n();
  return useCallback((key, params) => applyTranslation(pickTranslation(lang, key), params), [lang]);
}
