// BetCard — full bet flow: pick any viable coin, pick a side / mode, pick a
// budget, see the live quote, sign with TonConnect.
//
// All state and helpers (slider props, steppers, ticket caps, liquidity dot
// positions, quote normalisation) come from `useBet` — the integrator just
// renders. `bare` mode is used inside `BetDialog` to avoid stacking two glass
// surfaces.

import { useQueryClient } from "@tanstack/react-query";
import { formatBetQuoteReason, parseUnits, TON_ADDRESS } from "@toncast/sdk";
import { type BetMode, useBet } from "@toncast/sdk-react";
import { useIsConnectionRestored, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { formatRaw, ton } from "@/lib/format";
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
      void queryClient.invalidateQueries({ queryKey: ["toncast", "betting", "bets"] });
      void bet.refresh();
      for (const timer of refreshTimerRefs.current) clearTimeout(timer);
      refreshTimerRefs.current = [
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["toncast", "betting", "bets"] });
          void bet.refresh();
        }, 8_000),
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["toncast", "betting", "bets"] });
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
          {/* Render a Skeleton until the SDK's phase-1 summary lands (~200 ms)
              so we don't briefly flash "Pick a coin" before TON appears. */}
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
                  // Phase-1 jetton — wallet balance known but STON.fi pricing still loading.
                  // Show the symbol + native balance, replace the "≈ X TON" with a small loader.
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
                      // Pricing-in-progress jettons are non-selectable until phase 2 lands,
                      // but visible so the user knows their balance exists.
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
            <CoefficientSlider bet={bet} />
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
                  // Update bet live so the quote refreshes while typing,
                  // but only when the field is non-empty (never force-reset to 1).
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

        {/* Insufficient balance in limit/fixed mode */}
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

        {/* Quote breakdown */}
        <div className="glass-subtle space-y-1 rounded-xl p-3 text-xs">
          {!bet.quote.data && bet.quote.underlying.isFetching ? (
            // First-ever quote fetch: `keepPreviousData` makes `isLoading`
            // false even while truly loading (TanStack v5), so we branch on
            // `isFetching && !data`. Subsequent re-fetches keep the previous
            // quote visible so the modal doesn't jitter.
            <Skeleton className="h-4 w-1/2" />
          ) : !bet.quote.data && bet.quote.underlying.error ? (
            // Surface real errors so the user knows the modal is broken
            // rather than waiting for a quote that will never come.
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
              <Row label={t("bet.total")} value={`${ton(bet.quote.totalCost)} TON`} accent />
              {bet.quote.walletReserve > 0n ? (
                <>
                  <Row
                    label={t("bet.walletReserve")}
                    value={`${ton(bet.quote.walletReserve)} TON`}
                    dim
                  />
                  <Row
                    label={t("bet.required")}
                    value={`${ton(bet.quote.required)} TON`}
                    warn={!bet.quote.isFeasible && bet.quote.reason === "insufficient_balance"}
                  />
                </>
              ) : null}
              <div className="my-1 border-t border-border/50" />
              <Row
                label={t("bet.winnings", { side: t(`side.${bet.side}` as const) })}
                value={`${ton(bet.quote.winnings)} TON`}
                accent
              />
            </>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

interface CoefficientSliderProps {
  bet: ReturnType<typeof useBet>;
}

function CoefficientSlider({ bet }: CoefficientSliderProps) {
  const t = useT();
  const fillLeftPct = useMemo(() => {
    if (bet.mode !== "limit") return 0;
    const sliderPos = bet.oddsSliderProps.value[0];
    return (
      ((sliderPos - bet.oddsSliderProps.min) /
        (bet.oddsSliderProps.max - bet.oddsSliderProps.min)) *
      100
    );
  }, [bet.mode, bet.oddsSliderProps]);

  return (
    <div className="relative">
      {/*
        inset-x-2.5 mirrors Radix Slider's thumb-bounds offset (size-5 thumb = 20px →
        half = 10px = 2.5 * 4px). Within this container leftPct 0 % aligns with the
        thumb center at min value and 100 % aligns with the thumb center at max value,
        so both the fill bar and the liquidity dots stay in sync with the thumb.
      */}
      <div className="pointer-events-none absolute inset-x-2.5 inset-y-0 z-0">
        {bet.mode === "limit" && (
          <div
            className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-success"
            style={{ left: `${fillLeftPct}%`, right: "-10px" }}
          />
        )}
        {bet.liquidityMarkers.map((d) => (
          <span
            key={d.yesOdds}
            className="absolute top-1/2 size-1.5 rounded-full bg-destructive"
            style={{ left: `${d.leftPct}%`, transform: "translate(-50%, -50%)" }}
          />
        ))}
      </div>
      <Slider
        {...bet.oddsSliderProps}
        hideRange
        className="relative z-10"
        aria-label={t("bet.coefficient")}
      />
    </div>
  );
}

function BareWrapper({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 space-y-4 overflow-hidden p-4">{children}</div>;
}

function CardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="min-w-0 space-y-5 p-4 sm:p-6">{children}</div>
    </Card>
  );
}

function SidePill({
  active,
  kind,
  label,
  onClick,
}: {
  active: boolean;
  kind: "yes" | "no";
  label: string;
  onClick: () => void;
}) {
  const cls =
    kind === "yes"
      ? active
        ? "bg-success/25 text-success ring-1 ring-success/45 shadow-[0_4px_16px_-6px_color-mix(in_oklch,var(--color-success)_45%,transparent)]"
        : "bg-success/10 text-success hover:bg-success/20"
      : active
        ? "bg-destructive/25 text-destructive ring-1 ring-destructive/45 shadow-[0_4px_16px_-6px_color-mix(in_oklch,var(--color-destructive)_45%,transparent)]"
        : "bg-destructive/10 text-destructive hover:bg-destructive/20";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold tracking-tight transition-all duration-200 ease-out active:scale-[0.97] ${cls}`}
    >
      {label}
    </button>
  );
}

function Row({
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
