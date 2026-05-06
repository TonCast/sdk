import { useCallback } from "react";
import { useI18n } from "./I18nProvider";
import { EN_CATALOG, TRANSLATIONS, type TranslationKey } from "./translations";

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
