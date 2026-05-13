import type { SupportedLanguage } from "@toncast/sdk";
import { useToncastLanguage } from "@toncast/sdk-react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { formatDecimal, formatRawLocalized, formatTon } from "../utils/format";

/**
 * Locale-aware number formatters published on the i18n context — see
 * {@link I18nContextValue.fmt}. Keeping them on the same context as `lang`
 * removes the need for a second hook (was: `useFormatNumber`) in every call
 * site and guarantees `fmt`-identity is stable as long as `lang` does not
 * change.
 */
export interface NumberFormatters {
  /** `bigint` nano TON → grouped decimal string (e.g. `"1,234.5"` in `en-US`). */
  ton: (
    nano: bigint,
    opts?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
  ) => string;
  /** Arbitrary fixed-point bigint → grouped decimal string (used for jetton amounts). */
  raw: (amount: bigint, decimals: number, maxFracDigits?: number) => string;
  /** Generic `Number` → grouped/precision-controlled string (odds, percentages, …). */
  decimal: (
    value: number,
    opts?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
  ) => string;
}

interface I18nContextValue {
  lang: SupportedLanguage;
  setLang: (l: SupportedLanguage) => void;
  fmt: NumberFormatters;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useToncastLanguage();
  const fmt = useMemo<NumberFormatters>(
    () => ({
      ton: (nano, opts) => formatTon(nano, lang, opts),
      raw: (amount, decimals, maxFracDigits) =>
        formatRawLocalized(amount, decimals, lang, maxFracDigits),
      decimal: (value, opts) => formatDecimal(value, lang, opts),
    }),
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, fmt }), [lang, setLang, fmt]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
