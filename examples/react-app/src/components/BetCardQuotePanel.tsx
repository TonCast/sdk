import { formatBetQuoteReason } from "@toncast/sdk";
import type { UseBetResult } from "@toncast/sdk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ton } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useT } from "@/lib/i18n/useT";

export interface BetCardQuotePanelProps {
  bet: UseBetResult;
  sourceSym: string;
}

/** Live quote breakdown: matched / placed legs, totals, reserve, winnings. */
export function BetCardQuotePanel({ bet, sourceSym }: BetCardQuotePanelProps) {
  const t = useT();

  return (
    <div className="glass-subtle space-y-1 rounded-xl p-3 text-xs">
      {!bet.quote.data && bet.quote.underlying.isFetching ? (
        <Skeleton className="h-4 w-1/2" />
      ) : !bet.quote.data && bet.quote.underlying.error ? (
        <span className="text-destructive">
          {bet.quote.underlying.error instanceof Error
            ? bet.quote.underlying.error.message
            : String(bet.quote.underlying.error)}
        </span>
      ) : !bet.quote.data ? (
        <span className="text-muted-foreground">{t("bet.quoteWillAppear")}</span>
      ) : (
        <>
          {bet.quote.reason ? (
            <div className="mb-1 rounded-lg border border-yellow-700/40 bg-yellow-500/10 px-2 py-1 text-[11px] text-amber-700 dark:border-yellow-400/40 dark:bg-yellow-400/10 dark:text-yellow-400">
              {t("bet.previewOnly", {
                reason: formatBetQuoteReason(bet.quote.reason, { sourceSymbol: sourceSym }),
              })}
            </div>
          ) : null}
          {bet.quote.matched.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between gap-2 font-semibold text-success">
                <span className="min-w-0 truncate">
                  {t("bet.matched", { n: bet.quote.totals.matchedTickets })}
                </span>
                <span className="shrink-0 font-mono">
                  {ton(bet.quote.totals.matchedTicketCost)} TON
                </span>
              </div>
              {bet.quote.matched.map((m) => (
                <div
                  key={`m-${m.yesOdds}`}
                  className="flex items-baseline justify-between gap-2 pl-2 text-[11px] text-muted-foreground"
                >
                  <span className="min-w-0 truncate">
                    • {m.tickets} @ {m.yesOdds}% (×{m.decimalOdds.toFixed(2)})
                  </span>
                  <span className="shrink-0 font-mono">{ton(m.stake)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {bet.quote.placed ? (
            <div className="pt-1">
              <div className="flex items-baseline justify-between gap-2 font-semibold text-yellow-500 dark:text-yellow-400">
                <span className="min-w-0 truncate">
                  {t("bet.placed", { n: bet.quote.placed.tickets })}
                </span>
                <span className="shrink-0 font-mono">{ton(bet.quote.placed.cost)} TON</span>
              </div>
              <div className="pl-2 text-[11px] text-muted-foreground">
                {t("bet.placed.note", {
                  odds: bet.quote.placed.yesOdds,
                  mult: bet.quote.placed.decimalOdds.toFixed(2),
                })}
              </div>
            </div>
          ) : null}

          <div className="my-1 border-t border-border/50" />
          <QuoteRow label={t("bet.total")} value={`${ton(bet.quote.totalCost)} TON`} accent />
          {bet.quote.walletReserve > 0n ? (
            <>
              <QuoteRow
                label={t("bet.walletReserve")}
                value={`${ton(bet.quote.walletReserve)} TON`}
                dim
              />
              <QuoteRow
                label={t("bet.required")}
                value={`${ton(bet.quote.required)} TON`}
                warn={!bet.quote.isFeasible && bet.quote.reason === "insufficient_balance"}
              />
            </>
          ) : null}
          <div className="my-1 border-t border-border/50" />
          <QuoteRow
            label={t("bet.winnings", { side: t(`side.${bet.side}` as TranslationKey) })}
            value={`${ton(bet.quote.winnings)} TON`}
            accent
          />
        </>
      )}
    </div>
  );
}

function QuoteRow({
  label,
  value,
  dim,
  accent,
  warn,
}: {
  label: string;
  value: string;
  dim?: boolean;
  accent?: boolean;
  warn?: boolean;
}) {
  const labelColor = warn
    ? "text-amber-700 dark:text-yellow-400"
    : dim
      ? "text-muted-foreground/85"
      : "text-muted-foreground";
  const valueColor = warn
    ? "text-amber-700 dark:text-yellow-400"
    : accent
      ? "font-semibold text-foreground"
      : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`min-w-0 truncate ${labelColor}`}>{label}</span>
      <span className={`shrink-0 font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
