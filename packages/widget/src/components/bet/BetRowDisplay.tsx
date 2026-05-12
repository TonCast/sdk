import type { Bet, BetStatus } from "@toncast/sdk";
import { useT } from "../../i18n/useT";

/** Badge CSS class per `BetStatus` (widget stylesheet). */
export const BET_STATUS_BADGE_CLASS: Record<BetStatus, string> = {
  placed: "tc-badge-placed",
  matched: "tc-badge-matched",
  won: "tc-badge-won",
  won_yes: "tc-badge-won",
  won_no: "tc-badge-won",
  lost: "tc-badge-lost",
  cancelled: "tc-badge-cancelled",
  refunded: "tc-badge-refunded",
};

/** YES/NO side plus lifecycle status — no pari fields. */
export function BetRowBadges({ bet }: { bet: Bet }) {
  const t = useT();
  return (
    <div className="tc-bet-row-badges">
      <span className={`tc-badge ${bet.isYes ? "tc-badge-yes" : "tc-badge-no"}`}>
        {t(bet.isYes ? "side.yes" : "side.no")}
      </span>
      <span className={`tc-badge ${BET_STATUS_BADGE_CLASS[bet.status]}`}>
        {t(`bet.status.${bet.status}`)}
      </span>
    </div>
  );
}

/** Stake, ticket count, and date — shared by list and pari-detail rows. */
export function BetRowBetSummary({ bet }: { bet: Bet }) {
  const t = useT();
  const amountTon = (bet.amount / 1e9).toFixed(2);
  const date = new Date(bet.createdAt * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="tc-bet-row-meta">
      {t("bet.ticketsCount", { n: bet.ticketsCount })} · {amountTon} TON · {date}
    </div>
  );
}
