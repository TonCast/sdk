import { parseUnits } from "@toncast/sdk";
import type { useBet } from "@toncast/sdk-react";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/useT";
import { formatRaw } from "../../utils/format";
import { Slider } from "../ui/Slider";
import { BetStepper } from "./BetStepper";

type Bet = ReturnType<typeof useBet>;

interface Props {
  bet: Bet;
  sourceSym: string;
  sourceDecimals: number;
}

/** Market-mode amount input + slider + range hint. */
export function BetAmountInput({ bet, sourceSym, sourceDecimals }: Props) {
  const t = useT();
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    if (bet.mode !== "market" || !bet.source) return;
    setDraft(formatRaw(bet.sourceAmount, sourceDecimals, 4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet.mode, bet.source, bet.sourceAmount, sourceDecimals]); // derived display only

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
              typed = parseUnits(draft, sourceDecimals);
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
