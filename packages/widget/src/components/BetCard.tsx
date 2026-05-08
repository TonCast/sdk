import { formatBetQuoteReason, parseUnits, TON_ADDRESS } from "@toncast/sdk";
import { type BetMode, useBet, useTonConnectClient } from "@toncast/sdk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { formatRaw, ton } from "../utils/format";
import { Button } from "./ui/Button";
import { NativeSelect } from "./ui/Select";
import { Skeleton } from "./ui/Skeleton";
import { Slider } from "./ui/Slider";
import { TonDiamond } from "./ui/TonDiamond";

interface WalletSyncProps {
  address: string;
}

function WalletSync({ address }: WalletSyncProps) {
  useTonConnectClient(address || null);
  return null;
}

export interface BetCardProps {
  pariId: string;
  initialSide?: "yes" | "no";
  /** Called after the transaction is sent. amount is the total cost in nano-units. */
  onBetSent?: (pariId: string, amount: bigint, side: "yes" | "no") => void;
}

export function BetCard({ pariId, initialSide = "yes", onBetSent }: BetCardProps) {
  const t = useT();
  const { address, restored, connect, instance: tc } = useTcState();
  const connected = Boolean(address);

  const bet = useBet({
    pariId: connected ? pariId : null,
    defaultSide: initialSide,
  });

  const isYes = bet.side === "yes";

  const sourcePriced = bet.summary.data?.pricedCoins.find((p) => p.address === bet.source);
  const isTonSource = bet.source === TON_ADDRESS;
  const sourceSym = sourcePriced?.symbol ?? (isTonSource ? "TON" : "");
  const sourceDecimals = sourcePriced?.decimals ?? 9;

  const [amountDraft, setAmountDraft] = useState<string>("");
  useEffect(() => {
    if (bet.mode !== "market" || !bet.source) return;
    setAmountDraft(formatRaw(bet.sourceAmount, sourceDecimals, 4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet.mode, bet.source, bet.sourceAmount, sourceDecimals]); // derived display only

  const [ticketsDraft, setTicketsDraft] = useState<string>("");
  useEffect(() => {
    if (bet.mode === "market") return;
    setTicketsDraft(bet.tickets > 0 ? String(bet.tickets) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet.mode, bet.tickets]); // derived display only

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Ref to track the delayed refresh timer so it can be cancelled on unmount.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const handleConfirm = async () => {
    if (!tc) return;
    setSendError(null);
    setSending(true);
    try {
      const confirmed = await bet.confirmCurrent();
      if (!confirmed) return;
      await tc.sendTransaction({
        messages: confirmed.messages,
        validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
      });
      onBetSent?.(pariId, bet.quote.totalCost, bet.side);
      void bet.refresh();
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => void bet.refresh(), 8_000);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const coinOptions = bet.coins.map((cap) => {
    const sym = cap.source.symbol ?? (cap.source.address === TON_ADDRESS ? "TON" : "?");
    const decimals = cap.source.decimals ?? 9;
    const native = `${formatRaw(cap.source.amount, decimals, 4)} ${sym}`;
    const pricing = cap.reason === "pricing_in_progress";
    return {
      value: cap.source.address,
      label: pricing
        ? `${sym} — ${t("bet.loadingPrice")}`
        : !cap.feasible
          ? `${sym} (${cap.reason ?? t("bet.notViable")})`
          : native,
      disabled: !cap.feasible,
    };
  });

  return (
    <div>
      {/* Sync wallet address into ToncastClient */}
      <WalletSync address={address} />

      <div className="tc-bet-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "var(--tc-fg)" }}>
            {t("bet.title")}
          </span>
          <Button variant="yes" size="sm" active={isYes} onClick={() => bet.setSide("yes")}>
            {t("side.yes")}
          </Button>
          <Button variant="no" size="sm" active={!isYes} onClick={() => bet.setSide("no")}>
            {t("side.no")}
          </Button>
        </div>

        {!restored ? (
          <>
            <Skeleton style={{ height: 10, width: "60%" }} />
            <Skeleton style={{ height: 40 }} />
            <Skeleton style={{ height: 56 }} />
          </>
        ) : !connected ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
            }}
          >
            <p className="tc-text-sm tc-text-muted" style={{ textAlign: "center" }}>
              {t("bet.connectPrompt")}
            </p>
            <button type="button" className="tc-connect-btn" onClick={connect}>
              <TonDiamond />
              {t("wallet.connect")}
            </button>
          </div>
        ) : (
          <>
            {/* Mode tabs */}
            <div className="tc-mode-tabs" role="tablist" aria-label={t("bet.title")}>
              {(["market", "limit", "fixed"] as BetMode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={bet.mode === m}
                  className={`tc-mode-tab${bet.mode === m ? " tc-active" : ""}`}
                  onClick={() => bet.setMode(m)}
                >
                  {t(`bet.mode.${m}` as const)}
                </button>
              ))}
            </div>

            {/* Source coin */}
            <div>
              <div className="tc-label">{t("bet.sourceCoin")}</div>
              {!bet.summary.data ? (
                <Skeleton style={{ height: 40 }} />
              ) : (
                <NativeSelect
                  value={bet.source ?? ""}
                  onChange={(e) => bet.setSource(e.target.value)}
                  options={coinOptions}
                  placeholder={t("bet.sourceCoin.placeholder")}
                />
              )}
            </div>

            {/* Coefficient (Fixed/Limit) */}
            {bet.mode !== "market" && bet.selectedCoin && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="tc-label">{t("bet.coefficient")}</div>
                <div className="tc-stepper-row">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={!bet.oddsStepper.canDecrement}
                    onClick={bet.oddsStepper.decrement}
                  >
                    −
                  </Button>
                  <div
                    className="tc-input"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: 1,
                      pointerEvents: "none",
                    }}
                  >
                    ×{bet.quote.decimalOdds.toFixed(2)}
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={!bet.oddsStepper.canIncrement}
                    onClick={bet.oddsStepper.increment}
                  >
                    +
                  </Button>
                </div>
                <CoefficientSlider bet={bet} />
              </div>
            )}

            {/* Tickets (Fixed/Limit) */}
            {bet.selectedCoin && bet.maxTickets > 0 && bet.mode !== "market" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="tc-label">{t("bet.tickets")}</div>
                <div className="tc-stepper-row">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={!bet.ticketsStepper.canDecrement}
                    onClick={bet.ticketsStepper.decrement}
                  >
                    −
                  </Button>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="tc-input"
                    style={{ flex: 1 }}
                    value={ticketsDraft}
                    placeholder="1"
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setTicketsDraft(val);
                      if (val) {
                        const raw = Math.max(1, Math.trunc(Number(val)));
                        bet.setTickets(bet.mode === "fixed" ? Math.min(raw, bet.maxTickets) : raw);
                      }
                    }}
                    onBlur={() => {
                      const raw = Math.max(1, Math.trunc(Number(ticketsDraft) || 1));
                      const final = bet.mode === "fixed" ? Math.min(raw, bet.maxTickets) : raw;
                      bet.setTickets(final);
                      setTicketsDraft(String(final));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={!bet.ticketsStepper.canIncrement}
                    onClick={bet.ticketsStepper.increment}
                  >
                    +
                  </Button>
                </div>
              </div>
            )}

            {/* Amount (Market) */}
            {bet.selectedCoin && bet.mode === "market" && bet.maxTickets > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="tc-label">{t("bet.amount", { sym: sourceSym })}</div>
                <div className="tc-stepper-row">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={!bet.ticketsStepper.canDecrement}
                    onClick={bet.ticketsStepper.decrement}
                  >
                    −
                  </Button>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="tc-input"
                    style={{ flex: 1 }}
                    value={amountDraft}
                    placeholder="0.0"
                    onChange={(e) => setAmountDraft(e.target.value)}
                    onBlur={() => {
                      let typed: bigint;
                      try {
                        typed = parseUnits(amountDraft, sourceDecimals);
                      } catch {
                        // Revert to last valid amount so the user knows their input was rejected.
                        // setAmountDraft(
                        //   bet.sourceAmount > 0n ? formatRaw(bet.sourceAmount, sourceDecimals) : "",
                        // );
                        return;
                      }
                      bet.setTickets(Math.max(1, bet.ticketsForSourceAmount(typed)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={!bet.ticketsStepper.canIncrement}
                    onClick={bet.ticketsStepper.increment}
                  >
                    +
                  </Button>
                </div>
                <Slider {...bet.ticketsSliderProps} hideRange={false} />
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                  className="tc-text-xs tc-text-muted"
                >
                  <span>{t("bet.oneTicket")}</span>
                  <span>{t("bet.maxOf", { current: bet.tickets, max: bet.maxTickets })}</span>
                </div>
              </div>
            )}

            {bet.selectedCoin && bet.maxTickets <= 0 && bet.mode !== "market" && (
              <div className="tc-notice tc-notice-muted">{t("bet.balanceTooLow")}</div>
            )}

            <Button
              variant="primary"
              size="lg"
              disabled={!bet.quote.isFeasible || bet.confirm.isPending || sending}
              onClick={handleConfirm}
            >
              {bet.confirm.isPending || sending
                ? t("bet.action.confirming")
                : t("bet.action", { side: t(`side.${bet.side}` as const) })}
            </Button>

            {sendError && (
              <div className="tc-error" style={{ fontSize: 12 }}>
                {sendError}
              </div>
            )}

            {/* Quote breakdown */}
            <QuoteBox bet={bet} sourceSym={sourceSym} />
          </>
        )}
      </div>
    </div>
  );
}

function CoefficientSlider({ bet }: { bet: ReturnType<typeof useBet> }) {
  const fillLeftPct = useMemo(() => {
    if (bet.mode !== "limit") return 0;
    const { min, max, value } = bet.oddsSliderProps;
    const range = max - min;
    if (range === 0) return 0;
    return ((value[0] - min) / range) * 100;
  }, [bet.mode, bet.oddsSliderProps]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: "0 10px", pointerEvents: "none", zIndex: 0 }}>
        {bet.mode === "limit" && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              height: 8,
              borderRadius: 4,
              background: "var(--tc-success)",
              left: `${fillLeftPct}%`,
              right: -10,
            }}
          />
        )}
        {bet.liquidityMarkers.map((d, i) => (
          <span
            key={`liq-${d.yesOdds}-${i}`}
            style={{
              position: "absolute",
              top: "50%",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--tc-danger)",
              transform: "translate(-50%, -50%)",
              left: `${d.leftPct}%`,
            }}
          />
        ))}
      </div>
      <Slider {...bet.oddsSliderProps} hideRange style={{ position: "relative", zIndex: 1 }} />
    </div>
  );
}

function QuoteBox({ bet, sourceSym }: { bet: ReturnType<typeof useBet>; sourceSym: string }) {
  const t = useT();
  return (
    <div className="tc-quote-box">
      {!bet.quote.data && bet.quote.underlying.isFetching ? (
        <Skeleton style={{ height: 14, width: "40%" }} />
      ) : !bet.quote.data && bet.quote.underlying.error ? (
        <span style={{ color: "var(--tc-danger)", fontSize: 12 }}>
          {bet.quote.underlying.error instanceof Error
            ? bet.quote.underlying.error.message
            : String(bet.quote.underlying.error)}
        </span>
      ) : !bet.quote.data ? (
        <span className="tc-text-muted tc-text-sm">{t("bet.quoteWillAppear")}</span>
      ) : (
        <>
          {bet.quote.reason && (
            <div className="tc-notice tc-notice-warn" style={{ fontSize: 11, marginBottom: 4 }}>
              {t("bet.previewOnly", {
                reason: formatBetQuoteReason(bet.quote.reason, { sourceSymbol: sourceSym }),
              })}
            </div>
          )}
          {bet.quote.matched.length > 0 && (
            <div>
              <div className="tc-quote-row tc-quote-row-success">
                <span>{t("bet.matched", { n: bet.quote.totals.matchedTickets })}</span>
                <span className="tc-font-mono">{ton(bet.quote.totals.matchedTicketCost)} TON</span>
              </div>
              {bet.quote.matched.map((m, i) => (
                <div key={`m-${m.yesOdds}-${i}`} className="tc-quote-row" style={{ paddingLeft: 8 }}>
                  <span className="tc-quote-row-label tc-text-xs">
                    • {m.tickets} @ {m.yesOdds}% (×{m.decimalOdds.toFixed(2)})
                  </span>
                  <span className="tc-font-mono tc-text-xs">{ton(m.stake)}</span>
                </div>
              ))}
            </div>
          )}
          {bet.quote.placed && (
            <div style={{ paddingTop: 4 }}>
              <div className="tc-quote-row" style={{ color: "var(--tc-warn)", fontWeight: 600 }}>
                <span>{t("bet.placed", { n: bet.quote.placed.tickets })}</span>
                <span className="tc-font-mono">{ton(bet.quote.placed.cost)} TON</span>
              </div>
              <div className="tc-text-xs tc-text-muted" style={{ paddingLeft: 8 }}>
                {t("bet.placed.note", {
                  odds: bet.quote.placed.yesOdds,
                  mult: bet.quote.placed.decimalOdds.toFixed(2),
                })}
              </div>
            </div>
          )}
          <hr className="tc-divider" />
          <QuoteRow label={t("bet.total")} value={`${ton(bet.quote.totalCost)} TON`} accent />
          {bet.quote.walletReserve > 0n && (
            <>
              <QuoteRow
                label={t("bet.walletReserve")}
                value={`${ton(bet.quote.walletReserve)} TON`}
                muted
              />
              <QuoteRow
                label={t("bet.required")}
                value={`${ton(bet.quote.required)} TON`}
                warn={!bet.quote.isFeasible && bet.quote.reason === "insufficient_balance"}
              />
            </>
          )}
          <hr className="tc-divider" />
          <QuoteRow
            label={t("bet.winnings", { side: t(`side.${bet.side}` as const) })}
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
  return (
    <div className="tc-quote-row">
      <span
        className={`tc-quote-row-label${muted ? " tc-text-muted" : warn ? "" : ""}`}
        style={warn ? { color: "var(--tc-warn)" } : {}}
      >
        {label}
      </span>
      <span
        className={`tc-font-mono${accent ? " tc-quote-row-accent" : ""}`}
        style={warn ? { color: "var(--tc-warn)" } : {}}
      >
        {value}
      </span>
    </div>
  );
}

