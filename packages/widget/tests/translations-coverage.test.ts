import { SUPPORTED_LANGUAGES } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { EN_CATALOG, TRANSLATIONS, type TranslationKey } from "../src/i18n/translations";

/**
 * Runtime safety net for the i18n catalogue.
 *
 * The TypeScript `satisfies Record<SupportedLanguage, Record<TranslationKey, string>>`
 * already guarantees presence and types at compile time, but cannot catch a
 * value being an empty string or pure whitespace (e.g. accidentally cleared
 * during translation review). These tests stay shallow and noisy on purpose:
 * one failure per missing/empty key, easy to fix in isolation.
 */
describe("translations catalogue coverage", () => {
  const allKeys = Object.keys(EN_CATALOG) as TranslationKey[];

  it("covers every SupportedLanguage", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(TRANSLATIONS, `missing locale: ${lang}`).toHaveProperty(lang);
    }
  });

  it.each(SUPPORTED_LANGUAGES)("locale %s defines every key with a non-empty value", (lang) => {
    const catalog = TRANSLATIONS[lang];
    const missing: string[] = [];
    const empty: string[] = [];
    for (const key of allKeys) {
      const value = catalog[key];
      if (value === undefined) {
        missing.push(key);
      } else if (typeof value === "string" && value.trim() === "") {
        empty.push(key);
      }
    }
    expect(missing, `locale ${lang}: missing keys`).toEqual([]);
    expect(empty, `locale ${lang}: empty values`).toEqual([]);
  });
});
