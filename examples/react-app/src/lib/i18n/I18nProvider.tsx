// I18n context — thin wrapper around `useToncastLanguage` from `@toncast/sdk-react`.
//
// Source of truth for the active language is the Toncast client itself —
// it persists to `localStorage` and broadcasts changes to every subscriber.
// `useToncastLanguage` invalidates language-dependent React-Query caches on
// change so paris/categories refetch in the new locale automatically.
//
// We just expose `{ lang, setLang }` to the rest of the app via context so
// non-toncast consumers (UI strings) can subscribe without each component
// pulling the SDK hook.

import type { SupportedLanguage } from "@toncast/sdk";
import { useToncastLanguage } from "@toncast/sdk-react";
import { createContext, type ReactNode, useContext } from "react";

interface I18nContextValue {
  lang: SupportedLanguage;
  setLang: (l: SupportedLanguage) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const value = useToncastLanguage();
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
