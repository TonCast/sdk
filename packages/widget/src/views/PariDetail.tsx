import { DEFAULT_PARI_CHART_PARAMS, type Pari, pariCoverUrl } from "@toncast/sdk";
import { useSubscribe } from "@toncast/sdk-react";
import { useState } from "react";
import { BetCard } from "../components/BetCard";
import { CoefficientChart } from "../components/CoefficientChart";
import { OrderBook } from "../components/OrderBook";
import { Skeleton } from "../components/ui/Skeleton";
import { DESCRIPTION_PREVIEW_CHARS } from "../constants";
import { useEmitBet, useNav, type WidgetView } from "../context";
import { useT } from "../i18n/useT";

function isSettledOutcome(pari: Pari): boolean {
  const r = pari.result.trim().toLowerCase();
  return r === "yes" || r === "no" || r === "draw";
}

const descId = "tc-detail-desc-body";

function ExpandableDescription({ text }: { text: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > DESCRIPTION_PREVIEW_CHARS;

  return (
    <div>
      <p id={descId} className="tc-detail-desc">
        {needsTruncation && !expanded
          ? `${text.slice(0, DESCRIPTION_PREVIEW_CHARS).trimEnd()}…`
          : text}
      </p>
      {needsTruncation && (
        <button
          type="button"
          className="tc-detail-desc-toggle"
          aria-expanded={expanded}
          aria-controls={descId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}

function OutcomeBanner({ pari }: { pari: Pari }) {
  const t = useT();
  const raw = pari.result.trim();
  const r = raw === "" ? "pending" : raw.toLowerCase();

  if (r === "yes" || r === "no" || r === "draw") {
    const label =
      r === "yes" ? t("pari.result.yes") : r === "no" ? t("pari.result.no") : t("pari.result.draw");
    const cls = r === "yes" ? "tc-outcome-yes" : r === "no" ? "tc-outcome-no" : "tc-outcome-muted";
    return (
      <div className={cls}>
        <div className="tc-outcome-title">{t("pari.result.title")}</div>
        <div className="tc-outcome-value">{label}</div>
      </div>
    );
  }

  if (r === "pending" && pari.status === "inactive") {
    return <div className="tc-outcome-muted tc-text-sm">{t("pari.result.pendingInactive")}</div>;
  }

  if (r !== "pending") {
    return (
      <div className="tc-outcome-muted tc-text-sm">{t("pari.result.unknown", { result: raw })}</div>
    );
  }

  return null;
}

export function PariDetailView({ view }: { view: Extract<WidgetView, { name: "detail" }> }) {
  const t = useT();
  const { back } = useNav();
  // Bridges BetCard's positional `onBetSent` signature into the public `bet`
  // event payload shape so hosts only ever see one schema.
  const emitBet = useEmitBet();
  const onBet = emitBet
    ? (pariId: string, amount: bigint, side: "yes" | "no") => emitBet({ pariId, amount, side })
    : undefined;
  const {
    data: snap,
    isLoading,
    isError,
    error,
  } = useSubscribe(view.pariId, DEFAULT_PARI_CHART_PARAMS);

  if (isError) {
    return (
      <div>
        <button type="button" className="tc-back-btn" onClick={back}>
          {t("page.paris.detail.back")}
        </button>
        <div className="tc-error">
          {t("page.paris.detail.failed", {
            error: error instanceof Error ? error.message : String(error),
          })}
        </div>
      </div>
    );
  }

  const img = snap?.pari
    ? pariCoverUrl(snap.pari.image, "w=600,h=600,fit=contain,format=webp,quality=90")
    : null;

  return (
    <div className="tc-form-col">
      <button type="button" className="tc-back-btn" onClick={back}>
        {t("page.paris.detail.back")}
      </button>

      {/* Hero card */}
      {isLoading || !snap?.pari ? (
        <Skeleton style={{ height: 220, borderRadius: "var(--tc-radius)" }} />
      ) : (
        <div className="tc-card">
          {img && (
            <div className="tc-detail-img-wrapper">
              <div className="tc-detail-img-blur" style={{ backgroundImage: `url(${img})` }} />
              <img src={img} alt="" loading="eager" className="tc-detail-img" />
            </div>
          )}
          <div className="tc-card-body tc-detail-card-body">
            <div className="tc-detail-header-row">
              <h2 className="tc-detail-title">{snap.pari.name}</h2>
              <span className="tc-badge tc-badge-default tc-detail-meta-badge">
                {t(`pari.status.${snap.pari.status}` as Parameters<typeof t>[0]) ||
                  snap.pari.status}
              </span>
            </div>
            <ExpandableDescription text={snap.pari.description} />
            <div className="tc-detail-meta">
              <span>
                {t("pari.meta.yesVol")} <strong>{snap.pari.yesVolume.toFixed(2)} TON</strong>
              </span>
              <span>
                {t("pari.meta.noVol")} <strong>{snap.pari.noVolume.toFixed(2)} TON</strong>
              </span>
              {snap.pari.bestYesOdds !== null && (
                <span>
                  {t("pari.meta.bestYes")} <strong>{snap.pari.bestYesOdds}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {snap?.pari ? <OutcomeBanner pari={snap.pari} /> : null}

      {/* Bet card — wait for pari data before mounting to avoid empty interactions */}
      {!snap?.pari ? (
        <div className="tc-card">
          <Skeleton style={{ height: 180, borderRadius: "var(--tc-radius)" }} />
        </div>
      ) : isSettledOutcome(snap.pari) ? (
        <div className="tc-notice tc-notice-muted">{t("pari.bettingClosed")}</div>
      ) : (
        <div className="tc-card">
          <BetCard pariId={view.pariId} initialSide={view.initialSide} onBetSent={onBet} />
        </div>
      )}

      {/* Chart */}
      <div className="tc-card tc-card-body">
        <CoefficientChart history={snap?.coefficientHistory ?? []} />
      </div>

      {/* Order book */}
      <div className="tc-card">
        <div className="tc-card-header">
          <div className="tc-card-title">{t("orderBook.title")}</div>
        </div>
        <div className="tc-card-body">
          <OrderBook oddsState={snap?.oddsState ?? null} />
        </div>
      </div>
    </div>
  );
}
