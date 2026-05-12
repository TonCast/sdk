// BetCard — full bet flow: pick any viable coin, pick a side / mode, pick a
// budget, see the live quote, sign with TonConnect.
//
// All state and helpers (slider props, steppers, ticket caps, liquidity dot
// positions, quote normalisation) come from `useBet` — the integrator just
// renders. `bare` mode is used inside `BetDialog` to avoid stacking two glass
// surfaces.

import { useQueryClient } from "@tanstack/react-query";
import { parseUnits, TON_ADDRESS } from "@toncast/sdk";
import { type BetMode, toncastQueryKeys, useBet } from "@toncast/sdk-react";
import { useIsConnectionRestored, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BetCardCoefficientSlider } from "@/components/BetCardCoefficientSlider";
import { BetCardQuotePanel } from "@/components/BetCardQuotePanel";
import { BareWrapper, CardWrapper, SidePill } from "@/components/betCardShared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { formatRaw } from "@/lib/format";
import { useT } from "@/lib/i18n/useT";
import { ConnectButton } from "./ConnectButton";

export interface BetCardProps {
  pariId: string;
  /** Pre-selected side (e.g. user clicked YES on the tile). */
  initialSide?: "yes" | "no";
  /** Render WITHOUT the outer glass `<Card>` — used inside `BetDialog`. */
  bare?: boolean;
}

export function BetCard({ pariId, initialSide = "yes", bare = false }: BetCardProps) {
  const t = useT();
  const userAddress = useTonAddress();
  const [tc] = useTonConnectUI();
  const connectionRestored = useIsConnectionRestored();
  const queryClient = useQueryClient();

  const bet = useBet({
    pariId: userAddress ? pariId : null,
    defaultSide: initialSide,
  });

  const isYes = bet.side === "yes";

  // Source coin display helpers — only what the SDK doesn't already provide.
  const sourcePriced = bet.summary.data?.pricedCoins.find((p) => p.address === bet.source);
  const isTonSource = bet.source === TON_ADDRESS;
  const sourceSym = sourcePriced?.symbol ?? (isTonSource ? "TON" : "");
  const sourceDecimals = sourcePriced?.decimals ?? 9;

  const [amountDraft, setAmountDraft] = useState<string>("");
  const refreshTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      for (const timer of refreshTimerRefs.current) clearTimeout(timer);
      refreshTimerRefs.current = [];
    };
  }, []);

  useEffect(() => {
    if (bet.mode !== "market" || !bet.source) return;
    setAmountDraft(formatRaw(bet.sourceAmount, sourceDecimals, 4));
  }, [bet.mode, bet.source, bet.sourceAmount, sourceDecimals]);

  // Draft for the tickets input in fixed/limit mode — same pattern as amountDraft.
  // onChange only updates local state so the field can be fully cleared before the
  // user types a new number; bet.setTickets is called only on blur / Enter.
  const [ticketsDraft, setTicketsDraft] = useState<string>("");
  useEffect(() => {
    if (bet.mode === "market") return;
    setTicketsDraft(bet.tickets > 0 ? String(bet.tickets) : "");
  }, [bet.mode, bet.tickets]);

  const handleConfirm = async () => {
    try {
      const confirmed = await bet.confirmCurrent({ financialRiskAcknowledged: true });
      if (!confirmed) return;
      await tc.sendTransaction({
        messages: confirmed.messages,
        validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
      });
      toast.success(t("toast.betSent"));
      // Wallet balance changes once the on-chain tx settles. Refresh a few
      // times over the next ~30s so the UI catches the new state without
      // hammering toncenter.
      void queryClient.invalidateQueries({
        queryKey: [...toncastQueryKeys.betting.betsInvalidationPrefix],
      });
      void bet.refresh();
      for (const timer of refreshTimerRefs.current) clearTimeout(timer);
      refreshTimerRefs.current = [
        setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: [...toncastQueryKeys.betting.betsInvalidationPrefix],
          });
          void bet.refresh();
        }, 8_000),
        setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: [...toncastQueryKeys.betting.betsInvalidationPrefix],
          });
          void bet.refresh();
        }, 30_000),
      ];
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const Wrapper = bare ? BareWrapper : CardWrapper;

  if (!connectionRestored) {
    return (
      <Wrapper>
        <h3 className="text-base font-semibold tracking-tight">{t("bet.title")}</h3>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-56 w-full" />
      </Wrapper>
    );
  }

  if (!userAddress) {
    return (
      <Wrapper>
        <h3 className="text-base font-semibold tracking-tight">{t("bet.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bet.connectPrompt")}</p>
        <div className="flex justify-center pt-2">
          <ConnectButton />
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* Header — title + YES/NO pills */}
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
          {t("bet.title")}
        </h3>
        <SidePill
          active={isYes}
          kind="yes"
          label={t("side.yes")}
          onClick={() => bet.setSide("yes")}
        />
        <SidePill
          active={!isYes}
          kind="no"
          label={t("side.no")}
          onClick={() => bet.setSide("no")}
        />
      </div>

      {/* Mode selector */}
      <div className="flex rounded-lg overflow-hidden border border-border/50 text-xs font-medium">
        {(["market", "limit", "fixed"] as BetMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => bet.setMode(m)}
            className={`flex-1 py-1.5 text-center transition-colors ${
              bet.mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`bet.mode.${m}` as const)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Source coin */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="coin">
            {t("bet.sourceCoin")}
          </label>
          {!bet.summary.data ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={bet.source ?? ""} onValueChange={(v) => bet.setSource(v)}>
              <SelectTrigger id="coin">
                <SelectValue placeholder={t("bet.sourceCoin.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {bet.coins.map((cap) => {
                  const isTon = cap.source.address === TON_ADDRESS;
                  const sym = cap.source.symbol ?? (isTon ? "TON" : "?");
                  const decimals = cap.source.decimals ?? 9;
                  const native = `${formatRaw(cap.source.amount, decimals, 4)} ${sym}`;
                  const isPricing = cap.reason === "pricing_in_progress";
                  const priced = bet.summary.data?.pricedCoins.find(
                    (p) => p.address === cap.source.address,
                  );
                  const tonNano = priced?.tonEquivalent;
                  const tonEquiv =
                    !isTon && cap.feasible && tonNano !== undefined
                      ? `≈ ${formatRaw(tonNano, 9, 4)} TON`
                      : null;
                  const label = isPricing
                    ? native
                    : !cap.feasible
                      ? (cap.reason ?? t("bet.notViable"))
                      : native;
                  return (
                    <SelectItem
                      key={cap.source.address}
                      value={cap.source.address}
                      disabled={!cap.feasible}
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span>{sym}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {label}
                          {isPricing ? (
                            <span className="ml-1 inline-flex items-center gap-1 text-primary">
                              <span className="inline-block size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                              <span className="opacity-80">{t("bet.loadingPrice")}</span>
                            </span>
                          ) : tonEquiv ? (
                            <span className="opacity-60">{tonEquiv}</span>
                          ) : null}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Coefficient (Fixed / Limit) — stepper + slider */}
        {bet.mode !== "market" && bet.selectedCoin && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("bet.coefficient")}</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-10 shrink-0"
                disabled={!bet.oddsStepper.canDecrement}
                onClick={bet.oddsStepper.decrement}
              >
                −
              </Button>
              <div className="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.5))] flex items-center justify-center font-mono text-base text-foreground">
                ×{bet.quote.decimalOdds.toFixed(2)}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-10 shrink-0"
                disabled={!bet.oddsStepper.canIncrement}
                onClick={bet.oddsStepper.increment}
              >
                +
              </Button>
            </div>
            <BetCardCoefficientSlider bet={bet} />
          </div>
        )}

        {/* Tickets — input only for Fixed/Limit, amount-input + slider for Market */}
        {bet.selectedCoin && bet.maxTickets > 0 && bet.mode !== "market" && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("bet.tickets")}</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-10 shrink-0"
                disabled={!bet.ticketsStepper.canDecrement}
                onClick={bet.ticketsStepper.decrement}
              >
                −
              </Button>
              <input
                type="text"
                inputMode="numeric"
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
                className="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.5))] px-3 text-center font-mono text-base text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-10 shrink-0"
                disabled={!bet.ticketsStepper.canIncrement}
                onClick={bet.ticketsStepper.increment}
              >
                +
              </Button>
            </div>
          </div>
        )}

        {bet.selectedCoin && bet.mode === "market" && bet.maxTickets > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {t("bet.amount", { sym: sourceSym })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-10 shrink-0"
                disabled={!bet.ticketsStepper.canDecrement}
                onClick={bet.ticketsStepper.decrement}
              >
                −
              </Button>
              <input
                type="text"
                inputMode="decimal"
                value={amountDraft}
                placeholder="0.0"
                onChange={(e) => setAmountDraft(e.target.value)}
                onBlur={() => {
                  let typed: bigint;
                  try {
                    typed = parseUnits(amountDraft, sourceDecimals);
                  } catch {
                    return;
                  }
                  bet.setTickets(Math.max(1, bet.ticketsForSourceAmount(typed)));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.5))] px-3 text-center font-mono text-base text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-10 shrink-0"
                disabled={!bet.ticketsStepper.canIncrement}
                onClick={bet.ticketsStepper.increment}
              >
                +
              </Button>
            </div>
            <Slider {...bet.ticketsSliderProps} aria-label={t("bet.amount", { sym: sourceSym })} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("bet.oneTicket")}</span>
              <span>{t("bet.maxOf", { current: bet.tickets, max: bet.maxTickets })}</span>
            </div>
          </div>
        )}

        {bet.selectedCoin && bet.maxTickets <= 0 && bet.mode !== "market" && (
          <div className="glass-subtle rounded-xl p-3 text-sm text-muted-foreground">
            {t("bet.balanceTooLow")}
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!bet.quote.isFeasible || bet.confirm.isPending}
          onClick={handleConfirm}
        >
          {bet.confirm.isPending
            ? t("bet.action.confirming")
            : t("bet.action", { side: t(`side.${bet.side}` as const) })}
        </Button>

        <BetCardQuotePanel bet={bet} sourceSym={sourceSym} />
      </div>
    </Wrapper>
  );
}
