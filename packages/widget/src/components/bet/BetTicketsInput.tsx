import type { useBet } from "@toncast/sdk-react";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/useT";
import { BetStepper } from "./BetStepper";

type Bet = ReturnType<typeof useBet>;

/** Tickets stepper for fixed/limit modes — owns the local string draft state. */
export function BetTicketsInput({ bet }: { bet: Bet }) {
  const t = useT();
  const [draft, setDraft] = useState<string>("");

  // Sync draft from `bet.tickets` / `bet.mode` only — do not depend on the whole
  // `bet` object or the draft resets on unrelated bet updates while the user types.
  useEffect(() => {
    if (bet.mode === "market") return;
    setDraft(bet.tickets > 0 ? String(bet.tickets) : "");
  }, [bet.mode, bet.tickets]);

  const commit = (raw: number) => {
    const clean = Math.max(1, Math.trunc(raw || 1));
    return bet.mode === "fixed" ? Math.min(clean, bet.maxTickets) : clean;
  };

  return (
    <BetStepper
      label={t("bet.tickets")}
      canDecrement={bet.ticketsStepper.canDecrement}
      canIncrement={bet.ticketsStepper.canIncrement}
      onDecrement={bet.ticketsStepper.decrement}
      onIncrement={bet.ticketsStepper.increment}
    >
      <input
        type="text"
        inputMode="numeric"
        className="tc-input tc-stepper-input"
        value={draft}
        placeholder="1"
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "");
          setDraft(val);
          if (val) bet.setTickets(commit(Number(val)));
        }}
        onBlur={() => {
          const final = commit(Number(draft));
          bet.setTickets(final);
          setDraft(String(final));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </BetStepper>
  );
}
