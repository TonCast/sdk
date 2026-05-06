import { useQueryClient } from "@tanstack/react-query";
import type { SupportedLanguage } from "@toncast/sdk";
import { useCallback, useEffect, useState } from "react";
import { useToncastClient } from "../client/useToncastClient";

export interface UseToncastLanguageResult {
  /** Currently active language. Reflects `client.getLanguage()`. */
  lang: SupportedLanguage;
  /**
   * Apply a new language. Persists to `localStorage` (unless disabled in
   * `ToncastClient` options) and invalidates language-dependent React Query
   * caches so paris titles, categories, etc. are refetched in the new locale.
   */
  setLang: (lang: SupportedLanguage) => void;
}

/**
 * React glue over `client.setLanguage` / `client.onLanguageChange`.
 *
 * - Subscribes to SDK-level language changes so any caller updating the
 *   language (e.g. another tab via storage events, or programmatic sets)
 *   triggers a re-render.
 * - On change, invalidates **all** Toncast React-Query caches so language-
 *   dependent server data (paris titles, descriptions, categories) is
 *   re-fetched. The SDK's per-language category cache and per-pari WS
 *   subscriptions handle their own re-load through the same mechanism.
 *
 * Use this in your app's i18n provider as the source of truth for the
 * UI's language — no extra useState needed.
 */
export function useToncastLanguage(): UseToncastLanguageResult {
  const client = useToncastClient();
  const qc = useQueryClient();
  const [lang, setLangState] = useState<SupportedLanguage>(() => client.getLanguage());

  useEffect(() => {
    // Sync local state with whatever the client currently holds — covers
    // the case where another consumer set the language between this hook's
    // initial render and effect attachment.
    setLangState(client.getLanguage());
    return client.onLanguageChange((next) => {
      setLangState(next);
      // Drop every Toncast-namespaced query so server-localised data
      // refetches in the new language. The SDK's category cache is keyed
      // by language so the next fetch returns the new locale.
      void qc.invalidateQueries({ queryKey: ["toncast"] });
    });
  }, [client, qc]);

  const setLang = useCallback(
    (next: SupportedLanguage) => {
      client.setLanguage(next);
    },
    [client],
  );

  return { lang, setLang };
}
