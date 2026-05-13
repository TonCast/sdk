import { parseUnits } from "@toncast/sdk";
import type { useBet } from "@toncast/sdk-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { useFormatNumber } from "../../i18n/useFormatNumber";
import { useT } from "../../i18n/useT";
import { parseLocalizedDecimal } from "../../utils/format";
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
 * `useFormatNumber().raw(...)`. `parseUnits` requires `.`-decimal canonical
 * input, so on blur we route the draft through {@link parseLocalizedDecimal}
 * to strip group separators and convert the locale's decimal mark back to
 * `.` before delegating to the SDK parser.
 */
export function BetAmountInput({ bet, sourceSym, sourceDecimals }: Props) {
  const t = useT();
  const fmt = useFormatNumber();
  const { lang } = useI18n();
  const [draft, setDraft] = useState<string>("");

  // Stash the live formatter so the effect depends only on the inputs that
  // semantically drive a redraw (mode, source, amount, decimals, language).
  // `fmt` itself is rederived on every `lang` change — including it would
  // either trip Biome's exhaustive-deps rule or cause an extra resync.
  const fmtRef = useRef(fmt);
  fmtRef.current = fmt;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `lang` is intentionally listed so the displayed value re-formats when the user switches language; the formatter itself is read off `fmtRef` to avoid an extra resync on every formatter identity churn.
  useEffect(() => {
    if (bet.mode !== "market" || !bet.source) return;
    setDraft(fmtRef.current.raw(bet.sourceAmount, sourceDecimals, 4));
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
          type="text"
          inputMode="decimal"
          className="tc-input tc-stepper-input"
          value={draft}
          placeholder="0.0"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            let typed: bigint;
            try {
              typed = parseUnits(parseLocalizedDecimal(draft, lang), sourceDecimals);
            } catch {
              return;
            }
            bet.setTickets(Math.max(1, bet.ticketsForSourceAmount(typed)));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </BetStepper>
      <Slider
        {...bet.ticketsSliderProps}
        hideRange={false}
        aria-label={t("bet.amount", { sym: sourceSym })}
      />
      <div className="tc-form-row-between tc-text-xs tc-text-muted">
        <span>{t("bet.oneTicket")}</span>
        <span>{t("bet.maxOf", { current: bet.tickets, max: bet.maxTickets })}</span>
      </div>
    </div>
  );
}
