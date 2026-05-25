import { classifyBetFlowError, formatBetQuoteReason } from "@toncast/sdk";
import type { useBet } from "@toncast/sdk-react";
import { useI18n } from "../../i18n/I18nProvider";
import { useT } from "../../i18n/useT";
import { Skeleton } from "../ui/Skeleton";
import { resolveBetQuoteErrorTranslationKey } from "./resolveBetQuoteErrorTranslationKey";

type Bet = ReturnType<typeof useBet>;

/** Quote breakdown rendered below the action button in BetCard. */
export function BetQuoteBox({ bet, sourceSym }: { bet: Bet; sourceSym: string }) {
  const t = useT();
  const { fmt } = useI18n();
  return (
    <div className="tc-quote-box">
      {!bet.quote.data && bet.quote.underlying.isFetching ? (
        <Skeleton style={{ height: 14, width: "40%" }} />
      ) : !bet.quote.data && bet.quote.underlying.error ? (
        <details className="tc-quote-error-details">
          <summary className="tc-quote-error">{t("bet.quoteError")}</summary>
          <span className="tc-text-xs tc-text-muted">
            {t(
              resolveBetQuoteErrorTranslationKey(classifyBetFlowError(bet.quote.underlying.error)),
            )}
          </span>
          <span className="tc-text-xs tc-text-muted">
            {bet.quote.underlying.error instanceof Error
              ? bet.quote.underlying.error.message
              : String(bet.quote.underlying.error)}
          </span>
        </details>
      ) : !bet.quote.data ? (
        <span className="tc-text-muted tc-text-sm">{t("bet.quoteWillAppear")}</span>
      ) : (
        <>
          {bet.quote.reason && (
            <div className="tc-notice tc-notice-warn tc-quote-notice">
              {t("bet.previewOnly", {
                reason: formatBetQuoteReason(bet.quote.reason, { sourceSymbol: sourceSym }),
              })}
            </div>
          )}
          {bet.quote.matched.length > 0 && (
            <div>
              <div className="tc-quote-row tc-quote-row-success">
                <span>{t("bet.matched", { n: bet.quote.totals.matchedTickets })}</span>
                <span className="tc-font-mono">
                  {fmt.ton(bet.quote.totals.matchedTicketCost)} TON
                </span>
              </div>
              {bet.quote.matched.map((m) => (
                <div
                  key={`m-${m.yesOdds}-${m.tickets}-${m.stake.toString()}`}
                  className="tc-quote-row tc-quote-row-indent"
                >
                  <span className="tc-quote-row-label tc-text-xs">
                    • {m.tickets} @ {m.yesOdds}% (×{fmt.decimal(m.decimalOdds)})
                  </span>
                  <span className="tc-font-mono tc-text-xs">{fmt.ton(m.stake)}</span>
                </div>
              ))}
            </div>
          )}
          {bet.quote.placed && (
            <div className="tc-quote-row-placed-block">
              <div className="tc-quote-row tc-quote-row-warn">
                <span>{t("bet.placed", { n: bet.quote.placed.tickets })}</span>
                <span className="tc-font-mono">{fmt.ton(bet.quote.placed.cost)} TON</span>
              </div>
              <div className="tc-text-xs tc-text-muted tc-quote-row-indent">
                {t("bet.placed.note", {
                  odds: bet.quote.placed.yesOdds,
                  mult: fmt.decimal(bet.quote.placed.decimalOdds),
                })}
              </div>
            </div>
          )}
          <hr className="tc-divider" />
          <QuoteRow label={t("bet.total")} value={`${fmt.ton(bet.quote.totalCost)} TON`} accent />
          {bet.quote.walletReserve > 0n && (
            <>
              <QuoteRow
                label={t("bet.walletReserve")}
                value={`${fmt.ton(bet.quote.walletReserve)} TON`}
                muted
              />
              <QuoteRow
                label={t("bet.required")}
                value={`${fmt.ton(bet.quote.required)} TON`}
                warn={!bet.quote.isFeasible && bet.quote.reason === "insufficient_balance"}
              />
            </>
          )}
          <hr className="tc-divider" />
          <QuoteRow
            label={t("bet.winnings", { side: t(`side.${bet.side}` as const) })}
            value={`${fmt.ton(bet.quote.winnings)} TON`}
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
  accent,
  muted,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
  warn?: boolean;
}) {
  const warnCls = warn ? " tc-text-warn" : "";
  return (
    <div className="tc-quote-row">
      <span className={`tc-quote-row-label${muted ? " tc-text-muted" : ""}${warnCls}`}>
        {label}
      </span>
      <span className={`tc-font-mono${accent ? " tc-quote-row-accent" : ""}${warnCls}`}>
        {value}
      </span>
    </div>
  );
}
