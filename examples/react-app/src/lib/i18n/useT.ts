// Tiny translation hook. `t("bet.matched", { n: 20 })` — strict on key (TS
// completes them) and on params (must mention every `{name}` placeholder).
// Falls back to English when the active locale is missing the key.

import { useCallback } from "react";
import { EN_CATALOG, TRANSLATIONS, type TranslationKey } from "./translations";
import { useI18n } from "./I18nProvider";

type TParams = Record<string, string | number>;

export function useT(): (key: TranslationKey, params?: TParams) => string {
  const { lang } = useI18n();
  return useCallback(
    (key, params) => {
      const localised = TRANSLATIONS[lang]?.[key];
      const template = localised ?? EN_CATALOG[key];
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (_, name: string) => {
        const v = params[name];
        return v === undefined ? `{${name}}` : String(v);
      });
    },
    [lang],
  );
}
