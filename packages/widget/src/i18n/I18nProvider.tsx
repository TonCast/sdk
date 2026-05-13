import type { SupportedLanguage } from "@toncast/sdk";
import { useToncastLanguage } from "@toncast/sdk-react";
import { createContext, type ReactNode, useContext, useMemo } from "react";

interface I18nContextValue {
  lang: SupportedLanguage;
  setLang: (l: SupportedLanguage) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useToncastLanguage();
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
