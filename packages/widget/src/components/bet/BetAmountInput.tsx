import { parseUnits } from "@toncast/sdk";
import type { useBet } from "@toncast/sdk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { useT } from "../../i18n/useT";
import {
  AmbiguousLocalizedDecimalError,
  formatIntegerCount,
  formatRawLocalized,
  parseLocalizedDecimal,
} from "../../utils/format";
import { Slider } from "../ui/Slider";
import { BetStepper } from "./BetStepper";

type Bet = ReturnType<typeof useBet>;

interface Props {
  bet: Bet;
  sourceSym: string;
  sourceDecimals: number;
}

/**
 * Market-mode amount input + slider + range hint.
 *
 * The displayed `draft` is locale-formatted (grouping + decimal separator) via
 * {@link formatRawLocalized}. `parseUnits` requires `.`-decimal canonical
 * input, so on blur we route the draft through {@link parseLocalizedDecimal}
 * to strip group separators and convert the locale's decimal mark back to
 * `.` before delegating to the SDK parser.
 *
 * If {@link parseLocalizedDecimal} throws {@link AmbiguousLocalizedDecimalError}
 * (e.g. `35.572` under `de-DE`), we show a locale hint and skip applying the amount.
 *
 * The reformat-on-language-change effect skips when the input is currently
 * focused — otherwise the user's in-flight typing would be wiped if the host
 * flipped the locale mid-edit.
 */
export function BetAmountInput({ bet, sourceSym, sourceDecimals }: Props) {
  const t = useT();
  const { lang } = useI18n();
  const [draft, setDraft] = useState<string>("");
  const [parseHint, setParseHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Locale-shaped zero hint (e.g. `0,0000` in ru-RU) — matches blur parsing rules. */
  const amountPlaceholder = useMemo(
    () => formatRawLocalized(0n, sourceDecimals, lang, 4),
    [sourceDecimals, lang],
  );

  useEffect(() => {
    if (bet.mode !== "market" || !bet.source) return;
    if (inputRef.current && document.activeElement === inputRef.current) return;
    setDraft(formatRawLocalized(bet.sourceAmount, sourceDecimals, lang, 4));
  }, [bet.mode, bet.source, bet.sourceAmount, sourceDecimals, lang]);

  return (
    <div className="tc-form-col-sm">
      <BetStepper
        label={t("bet.amount", { sym: sourceSym })}
        canDecrement={bet.ticketsStepper.canDecrement}
        canIncrement={bet.ticketsStepper.canIncrement}
        onDecrement={bet.ticketsStepper.decrement}
        onIncrement={bet.ticketsStepper.increment}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          className="tc-input tc-stepper-input"
          value={draft}
          placeholder={amountPlaceholder}
          maxLength={32}
          onChange={(e) => {
            setParseHint(null);
            setDraft(e.target.value);
          }}
          onBlur={() => {
            setParseHint(null);
            let normalized: string;
            try {
              normalized = parseLocalizedDecimal(draft, lang);
            } catch (err) {
              if (err instanceof AmbiguousLocalizedDecimalError) {
                setParseHint(t("bet.ambiguousDecimal"));
                return;
              }
              throw err;
            }
            let typed: bigint;
            try {
              typed = parseUnits(normalized, sourceDecimals);
            } catch {
              return;
            }
            const count = bet.ticketsForSourceAmount(typed);
            const capped =
              bet.sliderMaxTickets > 0
                ? Math.min(Math.max(1, count), bet.sliderMaxTickets)
                : Math.max(1, count);
            bet.setTickets(capped);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </BetStepper>
      {parseHint ? (
        <p className="tc-text-xs tc-text-warn" role="alert">
          {parseHint}
        </p>
      ) : null}
      {bet.ticketsOverCap ? (
        <p className="tc-text-xs tc-text-warn" role="alert">
          {t("bet.ticketsOverCap", { max: bet.maxTickets })}
        </p>
      ) : null}
      <Slider
        {...bet.ticketsSliderProps}
        hideRange={false}
        aria-label={t("bet.amount", { sym: sourceSym })}
      />
      <div className="tc-form-row-between tc-text-xs tc-text-muted">
        <span>{t("bet.oneTicket")}</span>
        <span>
          {t("bet.maxOf", {
            current: formatIntegerCount(bet.effectiveTickets, lang),
            max: formatIntegerCount(
              bet.maxTickets > 0 ? bet.maxTickets : bet.sliderMaxTickets,
              lang,
            ),
          })}
        </span>
      </div>
    </div>
  );
}
