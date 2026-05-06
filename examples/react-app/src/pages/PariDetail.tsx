import { DEFAULT_PARI_CHART_PARAMS, pariCoverUrl, type Pari } from "@toncast/sdk";
import { useSubscribe } from "@toncast/sdk-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BetCard } from "@/components/BetCard";
import { CoefficientChart } from "@/components/CoefficientChart";
import { OrderBook } from "@/components/OrderBook";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/useT";

const DESCRIPTION_PREVIEW_LENGTH = 160;

function ExpandableDescription({ text }: { text: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > DESCRIPTION_PREVIEW_LENGTH;

  return (
    <div>
      <p className="whitespace-pre-line text-muted-foreground">
        {needsTruncation && !expanded
          ? text.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd() + "…"
          : text}
      </p>
      {needsTruncation && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-primary hover:underline"
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}

function isSettledOutcome(pari: Pari): boolean {
  const r = pari.result.trim().toLowerCase();
  return r === "yes" || r === "no" || r === "draw";
}

/** Surfaces `pari.result` from the API — invisible in the UI was the #1 gap on finished markets. */
function PariOutcomeBanner({ pari }: { pari: Pari }) {
  const t = useT();
  const raw = pari.result.trim();
  const r = raw === "" ? "pending" : raw.toLowerCase();

  if (r === "yes" || r === "no" || r === "draw") {
    const label = r === "yes" ? t("pari.result.yes") : r === "no" ? t("pari.result.no") : t("pari.result.draw");
    const cls =
      r === "yes"
        ? "border-success/45 bg-success/10 text-success"
        : r === "no"
          ? "border-destructive/45 bg-destructive/10 text-destructive"
          : "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300";
    return (
      <div className={`rounded-xl border px-4 py-3 ${cls}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide opacity-85">
          {t("pari.result.title")}
        </div>
        <div className="mt-1 text-lg font-semibold tracking-tight">{label}</div>
      </div>
    );
  }

  if (r === "pending" && pari.status === "inactive") {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
        {t("pari.result.pendingInactive")}
      </div>
    );
  }

  if (r !== "pending") {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/35 px-4 py-3 text-sm text-foreground">
        {t("pari.result.unknown", { result: raw || pari.result })}
      </div>
    );
  }

  return null;
}

export function PariDetailPage() {
  const t = useT();
  const { pariId } = useParams<{ pariId: string }>();
  // SDK preset for chart-driven detail pages: `{ coefficientHistory: { timeframe: "ALL", limit: 1000 } }`.
  // Stable reference — won't churn the WS pool on re-render.
  const { data: snap, isLoading, isError, error } = useSubscribe(pariId, DEFAULT_PARI_CHART_PARAMS);

  if (!pariId) return <div className="text-destructive">{t("page.paris.detail.notFound")}</div>;
  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6 text-destructive">
          {t("page.paris.detail.failed", { error: (error as Error).message })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        {t("page.paris.detail.back")}
      </Link>
      {isLoading || !snap?.pari ? (
        /* Skeleton mirrors the exact grid structure of the loaded card so
           content below doesn't shift when data arrives. */
        <Card className="overflow-hidden">
          <div className="grid sm:grid-cols-[240px_1fr] gap-0">
            <Skeleton className="aspect-video w-full sm:aspect-square sm:w-60" />
            <div className="flex flex-col justify-center p-6 space-y-3">
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-4 pt-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </Card>
      ) : (
        (() => {
          const img = pariCoverUrl(
            snap.pari.image,
            "w=600,h=600,fit=contain,format=webp,quality=90",
          );
          return (
            <Card className="overflow-hidden">
              <div className="grid sm:grid-cols-[240px_1fr] gap-0">
                {/* Ambient-background technique: a blurred, scaled-up copy of
                    the image fills the letterbox areas so there's no empty
                    void around portrait / landscape art.
                    The container locks the aspect-ratio so layout never
                    shifts once the card appears; `loading="eager"` ensures
                    the image request starts immediately (this is the hero). */}
                {img ? (
                  <div className="relative aspect-video w-full overflow-hidden sm:aspect-square sm:w-60">
                    {/* blurred ambient fill */}
                    <div
                      className="absolute inset-0 scale-125 bg-cover bg-center opacity-60 blur-xl"
                      style={{ backgroundImage: `url(${img})` }}
                    />
                    <img
                      src={img}
                      alt=""
                      loading="eager"
                      decoding="async"
                      className="relative h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-muted sm:aspect-square sm:w-60" />
                )}
                <div className="flex flex-col min-w-0">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-xl break-words min-w-0">
                        {snap.pari.name}
                      </CardTitle>
                      <Badge variant="outline" className="shrink-0">
                        {snap.pari.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <ExpandableDescription text={snap.pari.description} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span>
                        YES vol{" "}
                        <span className="text-foreground font-medium">
                          {snap.pari.yesVolume.toFixed(2)} TON
                        </span>
                      </span>
                      <span>
                        NO vol{" "}
                        <span className="text-foreground font-medium">
                          {snap.pari.noVolume.toFixed(2)} TON
                        </span>
                      </span>
                      {snap.pari.bestYesOdds !== null && (
                        <span>
                          best YES{" "}
                          <span className="text-foreground font-medium">
                            {snap.pari.bestYesOdds}
                          </span>
                        </span>
                      )}
                    </div>
                  </CardContent>
                </div>
              </div>
            </Card>
          );
        })()
      )}

      {snap?.pari ? <PariOutcomeBanner pari={snap.pari} /> : null}

      {/* Two-column layout from `md` (tablet) and up: chart + order
          book on the left, bet card pinned to the right in a narrow
          sticky sidebar. On phones (`< md`) everything stacks; bet
          card stays FIRST in DOM order so the action surface is
          visible immediately on the small screen, with chart + order
          book scrolling below.
          Sidebar width is `20rem` from `md` (tighter on iPad-ish
          widths) and grows to `22rem` from `lg` upward. */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 md:col-start-2 md:row-start-1 md:sticky md:top-20">
          {snap?.pari && isSettledOutcome(snap.pari) ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                {t("pari.bettingClosed")}
              </CardContent>
            </Card>
          ) : (
            <BetCard pariId={pariId} />
          )}
        </div>
        <div className="min-w-0 space-y-4 md:col-start-1 md:row-start-1">
          <Card>
            <CardContent className="pt-6">
              <CoefficientChart history={snap?.coefficientHistory ?? []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orderBook.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderBook oddsState={snap?.oddsState ?? null} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
