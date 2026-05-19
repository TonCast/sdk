import { useQueryClient } from "@tanstack/react-query";
import { type BetFlowErrorDescriptor, classifyBetFlowError, TON_ADDRESS } from "@toncast/sdk";
import { type BetMode, useBet, useTonConnectClient } from "@toncast/sdk-react";
import { useContext, useEffect, useRef, useState } from "react";
import { BET_REFRESH_DELAY_MS, BET_TX_VALID_FOR_SECONDS } from "../constants";
import { ConfigContext } from "../context";
import { useI18n } from "../i18n/I18nProvider";
import { useT } from "../i18n/useT";
import { useTcState } from "../tc-bridge";
import { BetAmountInput } from "./bet/BetAmountInput";
import { BetCoefficientSlider } from "./bet/BetCoefficientSlider";
import { BetConnectPrompt } from "./bet/BetConnectPrompt";
import { BetFlowErrorAlert } from "./bet/BetFlowErrorAlert";
import { BetQuoteBox } from "./bet/BetQuoteBox";
import { BetSourceSelect } from "./bet/BetSourceSelect";
import { BetStepper, StepperReadout } from "./bet/BetStepper";
import { BetTicketsInput } from "./bet/BetTicketsInput";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

/**
 * Keeps ToncastClient.userAddress in sync with the active wallet.
 * No-op when BetCard sits inside the full widget tree (WidgetShell already
 * calls useTonConnectClient — this is for standalone use of BetCard).
 */
function WalletSync({ address }: { address: string }) {
  useTonConnectClient(address || null);
  return null;
}

const BET_MODE_LABEL: Record<BetMode, string> = {
  market: "Market",
  limit: "Limit",
  fixed: "Fixed",
};

export interface BetCardProps {
  pariId: string;
  initialSide?: "yes" | "no";
  /** Called after the transaction is sent. amount is the total cost in nano-units. */
  onBetSent?: (pariId: string, amount: bigint, side: "yes" | "no") => void;
}

export function BetCard({ pariId, initialSide = "yes", onBetSent }: BetCardProps) {
  const t = useT();
  const { fmt } = useI18n();
  const { address, restored, connect, instance: tc } = useTcState();
  const connected = Boolean(address);
  const queryClient = useQueryClient();
  const widgetConfig = useContext(ConfigContext);
  const referralPct = widgetConfig?.widget?.referral?.pct ?? 0;

  const bet = useBet({
    pariId: connected ? pariId : null,
    defaultSide: initialSide,
    referralPct,
  });

  const isYes = bet.side === "yes";
  const sourcePriced = bet.summary.data?.pricedCoins.find((p) => p.address === bet.source);
  const isTonSource = bet.source === TON_ADDRESS;
  const sourceSym = sourcePriced?.symbol ?? (isTonSource ? "TON" : "");
  const sourceDecimals = sourcePriced?.decimals ?? 9;

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<BetFlowErrorDescriptor | null>(null);

  /** Aborts in-flight confirm/send when the card unmounts or the user retries. */
  const confirmFlowRef = useRef<AbortController | null>(null);

  // Cancel the delayed refresh timer on unmount.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      confirmFlowRef.current?.abort();
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const handleConfirm = async () => {
    if (!tc) return;
    confirmFlowRef.current?.abort();
    const flow = new AbortController();
    confirmFlowRef.current = flow;
    const { signal } = flow;

    setSendError(null);
    setSending(true);
    try {
      const confirmed = await bet.confirmCurrent({ financialRiskAcknowledged: true });
      if (signal.aborted) return;
      if (!confirmed) return;
      await tc.sendTransaction({
        messages: confirmed.messages,
        validUntil: Math.floor(Date.now() / 1000) + BET_TX_VALID_FOR_SECONDS,
      });
      if (signal.aborted) return;
      onBetSent?.(pariId, bet.quote.totalCost, bet.side);
      void queryClient.invalidateQueries({ queryKey: ["toncast", "betting", "bets"] });
      void bet.refresh();
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["toncast", "betting", "bets"] });
        void bet.refresh();
      }, BET_REFRESH_DELAY_MS);
    } catch (err) {
      if (signal.aborted) return;
      const classified = classifyBetFlowError(err);
      console.error("[ToncastWidget] Bet send failed:", classified.technicalSummary);
      setSendError(classified);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <WalletSync address={address} />

      <div className="tc-bet-card">
        <div className="tc-bet-side-toggle">
          <span className="tc-bet-side-toggle-title">{t("bet.title")}</span>
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
          <BetConnectPrompt onConnect={connect} />
        ) : (
          <>
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
                  {BET_MODE_LABEL[m]}
                </button>
              ))}
            </div>

            <BetSourceSelect bet={bet} />

            {bet.mode !== "market" && bet.selectedCoin && (
              <>
                <BetStepper
                  label={t("bet.coefficient")}
                  canDecrement={bet.oddsStepper.canDecrement}
                  canIncrement={bet.oddsStepper.canIncrement}
                  onDecrement={bet.oddsStepper.decrement}
                  onIncrement={bet.oddsStepper.increment}
                >
                  <StepperReadout>×{fmt.decimal(bet.quote.decimalOdds)}</StepperReadout>
                </BetStepper>
                <BetCoefficientSlider bet={bet} />
              </>
            )}

            {bet.selectedCoin && bet.maxTickets > 0 && bet.mode !== "market" && (
              <BetTicketsInput bet={bet} />
            )}

            {bet.selectedCoin && bet.mode === "market" && bet.maxTickets > 0 && (
              <BetAmountInput bet={bet} sourceSym={sourceSym} sourceDecimals={sourceDecimals} />
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
              <BetFlowErrorAlert descriptor={sendError} onDismiss={() => setSendError(null)} />
            )}

            <BetQuoteBox bet={bet} sourceSym={sourceSym} />
          </>
        )}
      </div>
    </div>
  );
}
