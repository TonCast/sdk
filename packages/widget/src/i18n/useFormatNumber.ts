import { useMemo } from "react";
import { formatDecimal, formatRawLocalized, formatTon } from "../utils/format";
import { useI18n } from "./I18nProvider";

/**
 * Locale-aware number formatters keyed off the current widget language.
 *
 * - `ton(nano)` — `bigint` nano TON → grouped decimal string.
 * - `raw(amount, decimals)` — arbitrary fixed-point bigint → grouped decimal string.
 * - `decimal(n, opts)` — generic `Number` → grouped/precision-controlled string.
 *
 * The returned object is memoised by `lang` so renders stay cheap and the
 * function references stay stable for `useEffect`/`useMemo` deps.
 */
export interface NumberFormatters {
  ton: (
    nano: bigint,
    opts?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
  ) => string;
  raw: (amount: bigint, decimals: number, maxFracDigits?: number) => string;
  decimal: (
    value: number,
    opts?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
  ) => string;
}

export function useFormatNumber(): NumberFormatters {
  const { lang } = useI18n();
  return useMemo<NumberFormatters>(
    () => ({
      ton: (nano, opts) => formatTon(nano, lang, opts),
      raw: (amount, decimals, maxFracDigits) =>
        formatRawLocalized(amount, decimals, lang, maxFracDigits),
      decimal: (value, opts) => formatDecimal(value, lang, opts),
    }),
    [lang],
  );
}
