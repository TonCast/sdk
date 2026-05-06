export const SUPPORTED_LANGUAGES = [
  "en",
  "ru",
  "hi",
  "es",
  "zh",
  "fr",
  "de",
  "pt",
  "fa",
  "ar",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

const SUPPORTED_SET = new Set<string>(SUPPORTED_LANGUAGES);

/**
 * Normalises a BCP-47 tag ("ru-RU", "zh-Hans-CN") to its primary subtag
 * and matches it against SUPPORTED_LANGUAGES.
 *
 * Resolution order:
 *   1. Explicit `input` (if any) → primary subtag → supported list → DEFAULT_LANGUAGE.
 *      An explicit input is ALWAYS preferred over the environment, even when
 *      it doesn't match a supported tag (we fall back to DEFAULT_LANGUAGE,
 *      not to `navigator.language`).
 *   2. No input → `navigator.language` / `navigator.languages` (browser only).
 *   3. Otherwise → DEFAULT_LANGUAGE.
 */
export function resolveLanguage(input: string | undefined): SupportedLanguage {
  if (input !== undefined) {
    const primary = primarySubtag(input);
    if (primary && SUPPORTED_SET.has(primary)) return primary as SupportedLanguage;
    return DEFAULT_LANGUAGE;
  }
  return detectEnvLanguage();
}

function detectEnvLanguage(): SupportedLanguage {
  // biome-ignore lint/suspicious/noExplicitAny: navigator is browser-only and may be undefined
  const nav = (globalThis as any).navigator as
    | { language?: string; languages?: string[] }
    | undefined;
  const candidates = nav ? [nav.language, ...(nav.languages ?? [])] : [];
  for (const tag of candidates) {
    const primary = primarySubtag(tag);
    if (primary && SUPPORTED_SET.has(primary)) return primary as SupportedLanguage;
  }
  return DEFAULT_LANGUAGE;
}

function primarySubtag(tag: string | undefined): string | undefined {
  if (!tag) return undefined;
  return tag.toLowerCase().split(/[-_]/)[0];
}
